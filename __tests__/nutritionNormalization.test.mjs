import assert from 'node:assert/strict';
import { test } from 'node:test';
import './loadTypescript.mjs';

const { normalizeNutrition, parseNutritionBasis, resolveNutritionBasis } = await import('../src/lib/nutritionNormalization.ts');
function nutrient(code = 'A001', value, extra = {}) {
  if (arguments.length < 2) value = '200';
  return {
    code, name: code === 'A001' ? '열량' : '단백질', value, unit: code === 'A001' ? 'kcal' : 'g',
    state: 'exact', needsReview: false, reviewReasons: [], notices: [], alternatives: [], ...extra,
  };
}
const basis = (type = 'per_quantity', quantity, unit, extra = {}) => ({
  type, quantity, unit, needsReview: false, needsUnitWeight: false, ...extra,
});
const input = (changes = {}) => ({
  package: { quantity: '300', unit: 'g' }, basis: basis('per_quantity', '100', 'g'),
  required: [nutrient()], additional: [nutrient('A009', '5')], ...changes,
});
const value = (record, code = 'A001') => [...record.required, ...record.additional].find(n => n.code === code);
const koreanError = error => error instanceof Error && /[가-힣]/u.test(error.message);

test('100 g source is stored for the entire 300 g product, including additional nutrients', () => {
  const source = input();
  const result = normalizeNutrition(source);
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.package, { quantity: '300', unit: 'g' });
  assert.equal(result.basis.type, 'total_package');
  assert.equal(result.factor, '3');
  assert.equal(value(result).value, '600');
  assert.equal(value(result, 'A009').value, '15');
  assert.equal(value(result).unit, 'kcal');
  assert.equal(value(result, 'A009').unit, 'g');
  assert.equal(result.source.basis.quantity, '100');
  assert.equal(value(result.source).value, '200');
});

test('OCR values already labelled total package are not multiplied by package weight', () => {
  const result = normalizeNutrition(input({ basis: basis('total_package', undefined, undefined) }));
  assert.equal(result.factor, '1');
  assert.equal(value(result).value, '200');
  assert.equal(value(result, 'A009').value, '5');
});

test('30 g per serving becomes ten servings for a 300 g product', () => {
  const result = normalizeNutrition(input({ basis: basis('per_serving', '30', 'g') }));
  assert.equal(result.factor, '10');
  assert.equal(value(result).value, '2000');
  assert.equal(value(result, 'A009').value, '50');
});

test('mass units can convert across kg, g and mg without changing nutrient units', () => {
  const kg = normalizeNutrition(input({ package: { quantity: '0.3', unit: 'kg' } }));
  assert.equal(kg.factor, '3');
  assert.equal(value(kg).value, '600');
  const mg = normalizeNutrition(input({ basis: basis('per_quantity', '100000', 'mg') }));
  assert.equal(mg.factor, '3');
  assert.equal(value(mg).value, '600');
  const small = normalizeNutrition(input({ package: { quantity: '100', unit: 'g' }, basis: basis('per_quantity', '1', 'kg') }));
  assert.equal(small.factor, '0.1');
  assert.equal(value(small).value, '20');
});

test('L and mL are compatible and preserve volume rather than guessing density', () => {
  const result = normalizeNutrition(input({ package: { quantity: '1.5', unit: 'L' }, basis: basis('per_quantity', '100', 'mL') }));
  assert.equal(result.factor, '15');
  assert.equal(value(result).value, '3000');
  assert.deepEqual(result.package, { quantity: '1.5', unit: 'L' });
});

test('mass and volume cannot be converted without an explicit linkage', () => {
  assert.throws(() => normalizeNutrition(input({ basis: basis('per_quantity', '100', 'mL') })), koreanError);
  assert.throws(() => normalizeNutrition(input({ package: { quantity: '300', unit: 'mL' } })), koreanError);
});

test('per unit cannot guess the mass of a piece or a serving', () => {
  assert.throws(() => normalizeNutrition(input({ basis: basis('per_unit', undefined, undefined, { count: '1', countUnit: '개' }) })), koreanError);
  const explicitWeight = normalizeNutrition(input({ basis: basis('per_unit', '30', 'g', { count: '1', countUnit: '개' }) }));
  assert.equal(explicitWeight.factor, '10');
});

test('matching explicit count units can be multiplied directly', () => {
  const result = normalizeNutrition(input({ package: { quantity: '3', unit: '개' }, basis: basis('per_unit', undefined, undefined, { count: '1', countUnit: '개' }) }));
  assert.equal(result.factor, '3');
  assert.equal(value(result).value, '600');
});

test('editing package quantity always recalculates from source, never an earlier normalized result', () => {
  const source = input();
  const first = normalizeNutrition(source);
  const second = normalizeNutrition({ ...source, package: { quantity: '500', unit: 'g' } });
  assert.equal(value(first).value, '600');
  assert.equal(value(second).value, '1000');
  assert.equal(value(second.source).value, '200');
  assert.deepEqual(normalizeNutrition(source), first);
});

test('normalization does not mutate the source basis, nutrient values or notices', () => {
  const source = input();
  const before = structuredClone(source);
  normalizeNutrition(source);
  assert.deepEqual(source, before);
});

test('zero remains an explicit zero while missing, trace and dash remain nonnumeric', () => {
  const entries = [
    nutrient('A001', '0.00', { state: 'explicit_zero' }),
    nutrient('A002', undefined, { state: 'not_detected' }),
    nutrient('A003', undefined, { state: 'trace', printedValue: 'Tr' }),
    nutrient('A004', undefined, { state: 'dash', printedValue: '-' }),
  ];
  const result = normalizeNutrition(input({ required: entries, additional: [] }));
  assert.equal(Number(value(result).value), 0);
  assert.equal(value(result).state, 'explicit_zero');
  for (const [code, state] of [['A002', 'not_detected'], ['A003', 'trace'], ['A004', 'dash']]) {
    assert.equal(value(result, code).state, state);
    assert.equal(value(result, code).value, undefined);
  }
  assert.equal(value(result, 'A003').printedValue, 'Tr');
  assert.equal(value(result, 'A004').printedValue, '-');
});

test('bounded values retain their operator while the numeric boundary is scaled', () => {
  const result = normalizeNutrition(input({ required: [nutrient('A001', '0.5', { state: 'bounded', operator: 'lt' })], additional: [] }));
  assert.equal(value(result).value, '1.5');
  assert.equal(value(result).state, 'bounded');
  assert.equal(value(result).operator, 'lt');
  assert.equal(value(result.source).value, '0.5');
});

test('decimal scaling avoids binary float artifacts and rounds repeating fractions to 12 places', () => {
  const exact = normalizeNutrition(input({ package: { quantity: '0.3', unit: 'g' }, basis: basis('per_quantity', '0.1', 'g'), required: [nutrient('A001', '0.1')], additional: [] }));
  assert.equal(value(exact).value, '0.3');
  const thirds = normalizeNutrition(input({ package: { quantity: '1', unit: 'g' }, basis: basis('per_quantity', '3', 'g'), required: [nutrient('A001', '1')], additional: [] }));
  assert.equal(thirds.factor, '0.333333333333');
  assert.equal(value(thirds).value, '0.333333333333');
});

for (const invalid of ['', '0', '-1', 'NaN', 'Infinity', '1e309']) {
  test(`invalid or nonpositive package quantity ${JSON.stringify(invalid)} is rejected`, () => {
    assert.throws(() => normalizeNutrition(input({ package: { quantity: invalid, unit: 'g' } })), koreanError);
  });
  test(`invalid or nonpositive source quantity ${JSON.stringify(invalid)} is rejected`, () => {
    assert.throws(() => normalizeNutrition(input({ basis: basis('per_quantity', invalid, 'g') })), koreanError);
  });
}

for (const type of ['unknown', 'per_daily_intake']) {
  test(`unresolved ${type} cannot silently become a total-package basis`, () => {
    assert.throws(() => normalizeNutrition(input({ basis: basis(type, undefined, undefined) })), koreanError);
  });
}


test('explicit basis labels parse into quantities without inferring density or serving mass', () => {
  const total = parseNutritionBasis('총 내용량당');
  assert.equal(total.type, 'total_package');
  const quantity = parseNutritionBasis('100 g당');
  assert.equal(quantity.type, 'per_quantity');
  assert.equal(quantity.quantity, '100');
  assert.equal(quantity.unit, 'g');
  const volume = parseNutritionBasis('100ml');
  assert.equal(volume.unit, 'mL');
  const serving = parseNutritionBasis('1회 제공량(30 g)당');
  assert.equal(serving.type, 'per_serving');
  assert.equal(serving.quantity, '30');
  const piece = parseNutritionBasis('1봉(40 g)당');
  assert.equal(piece.type, 'per_unit');
  assert.equal(piece.count, '1');
  assert.equal(piece.countUnit, '봉');
  assert.equal(piece.quantity, '40');
});

test('ambiguous basis prose requires explicit user correction', () => {
  for (const text of ['', '1회 제공량당', '100g당 또는 1봉당', '제품 기준', '하루 권장량']) {
    assert.throws(() => parseNutritionBasis(text), koreanError);
  }
});

test('unchanged OCR basis preserves its structured serving amount, while edited text is parsed anew', () => {
  const original = basis('per_serving', '30', 'g', { printedText: 'per serving' });
  assert.deepEqual(resolveNutritionBasis('per serving', original), original);
  const edited = resolveNutritionBasis('100 g당', original);
  assert.equal(edited.type, 'per_quantity');
  assert.equal(edited.quantity, '100');
  assert.deepEqual(original, basis('per_serving', '30', 'g', { printedText: 'per serving' }));
  const unresolved = resolveNutritionBasis('100 g당', basis('unknown', undefined, undefined, { printedText: '100 g당' }));
  assert.equal(unresolved.type, 'per_quantity');
  const total = basis('total_package', '300', 'g', { printedText: '총 내용량당' });
  assert.deepEqual(resolveNutritionBasis('300 g당', total), total);
});

test('17-place Excel source decimals are accepted and retained with only normalized output rounded', () => {
  const text = '9.8800000000000008';
  const result = normalizeNutrition(input({ required: [nutrient('A001', text)], additional: [] }));
  assert.equal(value(result).value, '29.64');
  assert.equal(value(result.source).value, text);
});

test('quantity precision is limited to 12 places while source values allow up to 24 places', () => {
  assert.throws(() => normalizeNutrition(input({ package: { quantity: '1.1234567890123', unit: 'g' } })), koreanError);
  assert.throws(() => normalizeNutrition(input({ basis: basis('per_quantity', '1.1234567890123', 'g') })), koreanError);
  const longValue = '1.123456789012345678901234';
  const result = normalizeNutrition(input({ required: [nutrient('A001', longValue)], additional: [] }));
  assert.equal(value(result).value, '3.370370367037');
  assert.equal(value(result.source).value, longValue);
  assert.throws(() => normalizeNutrition(input({ required: [nutrient('A001', longValue + '5')], additional: [] })), koreanError);
});

test('normalization removes source percentages from totals but retains them in the original snapshot', () => {
  const result = normalizeNutrition(input({ required: [nutrient('A001', '200', { referencePercent: '10' })], additional: [] }));
  assert.equal(value(result).referencePercent, undefined);
  assert.equal(value(result.source).referencePercent, '10');
});

test('already normalized totals can pass through without multiplying a second time', () => {
  const first = normalizeNutrition(input());
  const again = normalizeNutrition(first);
  assert.equal(again.factor, '1');
  assert.equal(value(again).value, '600');
  assert.equal(value(again, 'A009').value, '15');
});

test('values that would underflow to zero or exceed the integer limit are rejected', () => {
  assert.throws(() => normalizeNutrition(input({ required: [nutrient('A001', '0.000000000000000000000001')], additional: [] })), koreanError);
  assert.throws(() => normalizeNutrition(input({ package: { quantity: '999999999999999999999999', unit: 'g' }, basis: basis('per_quantity', '1', 'g'), required: [nutrient('A001', '999999999999999999999999')], additional: [] })), koreanError);
});

test('explicit OCR total-package amount remains the source denominator when package content is corrected', () => {
  const source = input({ package: { quantity: '600', unit: 'g' }, basis: basis('total_package', '300', 'g') });
  const doubled = normalizeNutrition(source);
  assert.equal(doubled.factor, '2');
  assert.equal(value(doubled).value, '400');
  assert.equal(value(doubled, 'A009').value, '10');
  assert.equal(doubled.source.basis.quantity, '300');
  const tripled = normalizeNutrition({ ...source, package: { quantity: '900', unit: 'g' } });
  assert.equal(tripled.factor, '3');
  assert.equal(value(tripled).value, '600');
  assert.equal(value(tripled.source).value, '200');
  assert.equal(source.required[0].value, '200');
});

test('explicit OCR total-package units must be compatible with the corrected target package', () => {
  assert.throws(() => normalizeNutrition(input({ package: { quantity: '300', unit: 'mL' }, basis: basis('total_package', '300', 'g') })), koreanError);
});

test('total-package values without a source amount describe the current entire package', () => {
  const result = normalizeNutrition(input({ package: { quantity: '600', unit: 'g' }, basis: basis('total_package', undefined, undefined) }));
  assert.equal(result.factor, '1');
  assert.equal(value(result).value, '200');
});

test('partly specified total-package source amount cannot silently bypass normalization', () => {
  assert.throws(() => normalizeNutrition(input({ basis: basis('total_package', '300', undefined) })), koreanError);
  assert.throws(() => normalizeNutrition(input({ basis: basis('total_package', undefined, 'g') })), koreanError);
});

test('photo label values stay as printed even for a 100g label and 300g package', async () => {
  const { prepareNutritionRegistration } = await import('../src/lib/nutritionNormalization.ts');
  const source = input({ package: { quantity: '300', unit: 'g' } });
  const label = prepareNutritionRegistration(source, 'photo');
  assert.equal(label.valueBasis, 'label');
  assert.equal(label.factor, '1');
  assert.deepEqual(label.required, source.required);
  assert.deepEqual(label.basis, source.basis);
  const database = prepareNutritionRegistration(source, 'reference');
  assert.equal(database.valueBasis, 'fms_unit');
  assert.equal(database.factor, '3');
  assert.equal(database.basis.type, 'total_package');
});

test('manual entry and 1-serving labels do not need an invented serving weight', async () => {
  const { prepareNutritionRegistration } = await import('../src/lib/nutritionNormalization.ts');
  const source = input({ basis: { type: 'per_serving', count: '1', countUnit: '회분', needsReview: false, needsUnitWeight: true } });
  for (const origin of ['manual', 'photo']) {
    const saved = prepareNutritionRegistration(source, origin);
    assert.deepEqual(saved.required, source.required);
    assert.deepEqual(saved.basis, source.basis);
    assert.equal(saved.valueBasis, 'label');
  }
});

test('correcting total content changes the metadata, not the printed whole-package calories', async () => {
  const { prepareNutritionRegistration } = await import('../src/lib/nutritionNormalization.ts');
  const source = input({ package: { quantity: '300', unit: 'g' }, basis: { type: 'total_package', quantity: '80', unit: 'g', needsReview: false, needsUnitWeight: false } });
  const saved = prepareNutritionRegistration(source, 'photo');
  assert.deepEqual(saved.required, source.required);
  assert.equal(saved.basis.quantity, '300');
  assert.equal(saved.package.quantity, '300');
  assert.equal(saved.source.basis.quantity, '80');
});
