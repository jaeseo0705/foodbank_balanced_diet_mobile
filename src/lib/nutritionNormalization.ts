import type { NutritionBasis, NutritionValue } from './nutrition.types';

export type NutritionInput = { package: { quantity: string; unit: string }; basis: NutritionBasis; required: NutritionValue[]; additional: NutritionValue[] };
export type NormalizedNutrition = {
  schemaVersion: 1; package: { quantity: string; unit: string }; basis: NutritionBasis; factor: string;
  required: NutritionValue[]; additional: NutritionValue[];
  source: { basis: NutritionBasis; required: NutritionValue[]; additional: NutritionValue[] };
};
export type NutritionRegistration = NormalizedNutrition & {
  origin: 'photo' | 'manual' | 'reference'; fmsUnit: string; valueBasis?: 'label' | 'fms_unit';
  original?: { basis: NutritionBasis; package?: { quantity: string; unit: string }; required: NutritionValue[]; additional: NutritionValue[] };
  provenance?: { sourceKey: string; recordKey: string; name: string; title: string; publisher: string; version: string;
    basis: string; headers: unknown; rawValues: Record<string, string> };
};
const decimalPattern = /^\d{1,24}(?:\.\d{1,24})?$/;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export function canonicalQuantityUnit(unit: string): string {
  const s = unit.normalize('NFKC').trim();
  return ({ g: 'g', kg: 'kg', mg: 'mg', ml: 'mL', l: 'L' } as Record<string, string>)[s.toLowerCase()] ?? s;
}
function fraction(value: string): [bigint, bigint] {
  const text = value.normalize('NFKC').trim();
  if (!decimalPattern.test(text)) throw Error('수량·함량은 소수점 아래 24자리 이내의 양수 또는 0으로 입력해 주세요.');
  const [whole, decimals = ''] = text.split('.');
  return [BigInt(whole + decimals), 10n ** BigInt(decimals.length)];
}
function positive(value: string): [bigint, bigint] {
  if (!/^\d{1,24}(?:\.\d{1,12})?$/.test(value.normalize('NFKC').trim())) throw Error('수량은 소수점 아래 12자리 이내로 입력해 주세요.');
  if (value.normalize('NFKC').trim().replace('.', '').length > 24) throw Error('총 내용량과 원본 기준량의 자릿수를 확인해 주세요.');
  const pair = fraction(value);
  if (pair[0] <= 0n) throw Error('총 내용량과 원본 기준량은 0보다 커야 합니다.');
  return pair;
}
function format(n: bigint, d: bigint): string {
  const precision = 10n ** 12n;
  const rounded = (n * precision * 2n + d) / (2n * d);
  const whole = rounded / precision, rest = (rounded % precision).toString().padStart(12, '0').replace(/0+$/, '');
  return rest ? `${whole}.${rest}` : whole.toString();
}
const dimensions: Record<string, [string, bigint]> = {
  mg: ['mass', 1n], g: ['mass', 1000n], kg: ['mass', 1000000n], mL: ['volume', 1n], L: ['volume', 1000n],
};

// Parse only explicit, unambiguous basis labels. No g/mL conversion or inferred serving size.
export function parseNutritionBasis(text: string): NutritionBasis {
  const printedText = text.normalize('NFKC').trim();
  const common = { printedText, needsReview: false, needsUnitWeight: false };
  if (/^(총\s*내용량|전체|한\s*포장)(당)?$/.test(printedText)) return { ...common, type: 'total_package' };
  const amount = '(\\d+(?:\\.\\d+)?)\\s*(mg|kg|g|ml|l)';
  const simple = printedText.match(new RegExp(`^${amount}\\s*(?:당)?$`, 'i'));
  if (simple) return { ...common, type: 'per_quantity', quantity: simple[1], unit: canonicalQuantityUnit(simple[2]) };
  const serving = printedText.match(new RegExp(`^1\\s*회\\s*(?:제공량|분|섭취량)\\s*\\(\\s*${amount}\\s*\\)\\s*(?:당)?$`, 'i'));
  if (serving) return { ...common, type: 'per_serving', quantity: serving[1], unit: canonicalQuantityUnit(serving[2]) };
  const count = printedText.match(new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*([가-힣]+)\\s*\\(\\s*${amount}\\s*\\)\\s*(?:당)?$`, 'i'));
  if (count) return { ...common, type: 'per_unit', count: count[1], countUnit: count[2], quantity: count[3], unit: canonicalQuantityUnit(count[4]) };
  throw Error('입력값 기준을 선택하거나 100 g당, 1회 제공량(30 g)당처럼 기준량을 입력해 주세요.');
}
export function resolveNutritionBasis(text: string, original: NutritionBasis): NutritionBasis {
  // Keep explicit OCR structure when the displayed text is unchanged (e.g. 영문 표기).
  if (original.type === 'total_package' && original.quantity && original.unit && text.replace(/\s/g, '') === `${original.quantity}${original.unit}당`) return { ...original };
  if (original.type !== 'unknown' && text.trim() === original.printedText?.trim()) return { ...original };
  return parseNutritionBasis(text);
}

export function normalizeNutrition(input: NutritionInput): NormalizedNutrition {
  const [pn, pd] = positive(input.package.quantity);
  const packageUnit = canonicalQuantityUnit(input.package.unit);
  if (!packageUnit || packageUnit.length > 20) throw Error('물품 1개당 총 내용량의 단위를 확인해 주세요.');
  const basis = input.basis;
  let fn = 1n, fd = 1n;
  if ((basis.quantity && !basis.unit) || (!basis.quantity && basis.unit)) throw Error('원본 기준량의 수량과 단위를 함께 입력해 주세요.');
  if (basis.type !== 'total_package' || basis.quantity || basis.unit) {
    if (basis.type === 'unknown' || basis.type === 'per_daily_intake') throw Error('원본 영양정보의 기준량을 확인해 주세요.');
    const bq = basis.quantity ?? (basis.type === 'per_unit' ? basis.count : undefined);
    const bu = canonicalQuantityUnit(basis.unit ?? (basis.type === 'per_unit' ? basis.countUnit : '') ?? '');
    if (!bq || !bu) throw Error('1회분 또는 1단위에 해당하는 중량·부피를 입력해 주세요.');
    const [bn, bd] = positive(bq), pDim = dimensions[packageUnit], bDim = dimensions[bu];
    if (packageUnit !== bu && (!pDim || !bDim || pDim[0] !== bDim[0])) throw Error('총 내용량과 기준량의 단위를 맞춰 주세요. g과 mL는 자동 환산하지 않습니다.');
    fn = pn * bd * (pDim?.[1] ?? 1n); fd = pd * bn * (bDim?.[1] ?? 1n);
  }
  if (format(fn, fd) === '0') throw Error('환산 배수가 너무 작습니다. 총 내용량과 기준량을 확인해 주세요.');
  const scale = (item: NutritionValue): NutritionValue => {
    const copy = clone(item);
    delete copy.referencePercent;
    if (item.value === undefined || item.value.trim() === '') { delete copy.value; return copy; }
    if (!['exact', 'explicit_zero', 'bounded'].includes(item.state)) throw Error(`${item.name}의 미량·누락·불확실한 표시에 임의의 숫자를 적용할 수 없습니다.`);
    const [n, d] = fraction(item.value);
    delete copy.printedValue; delete copy.printedUnit;
    copy.value = format(n * fn, d * fd);
    if (n !== 0n && copy.value === '0') throw Error(`${item.name}의 환산값이 너무 작습니다. 원본 단위를 확인해 주세요.`);
    if (copy.value.split('.')[0].length > 24) throw Error(`${item.name}의 환산값이 너무 큽니다.`);
    if (item.state !== 'bounded') copy.state = n === 0n ? 'explicit_zero' : 'exact';
    return copy;
  };
  return { schemaVersion: 1, package: { quantity: input.package.quantity.normalize('NFKC').trim(), unit: packageUnit },
    basis: { type: 'total_package', quantity: input.package.quantity, unit: packageUnit, printedText: '총 내용량당', needsReview: false, needsUnitWeight: false },
    factor: format(fn, fd), required: input.required.map(scale), additional: input.additional.map(scale),
    source: clone({ basis, required: input.required, additional: input.additional }) };
}

// Labels are registered as printed. Only a public DB reference is converted to an FMS unit.
export function prepareNutritionRegistration(input: NutritionInput, origin: 'photo' | 'manual' | 'reference'): NormalizedNutrition & { valueBasis: 'label' | 'fms_unit' } {
  if (origin === 'reference') return { ...normalizeNutrition(input), valueBasis: 'fms_unit' };
  positive(input.package.quantity);
  const unit = canonicalQuantityUnit(input.package.unit);
  if (!unit || unit.length > 20) throw Error('총 내용량의 단위를 확인해 주세요.');
  if (input.basis.type === 'unknown') throw Error('영양성분표의 함량 기준을 확인해 주세요.');
  if (input.basis.type === 'per_quantity') {
    if (!input.basis.quantity || !input.basis.unit) throw Error('영양성분표의 기준량과 단위를 확인해 주세요.');
    positive(input.basis.quantity);
  }
  for (const item of [...input.required, ...input.additional]) if (item.value !== undefined && item.value !== '') {
    fraction(item.value);
    if (!['exact', 'explicit_zero', 'bounded'].includes(item.state)) throw Error(`${item.name}의 값을 확인해 주세요.`);
  }
  const labelBasis = input.basis.type === 'total_package' ? { ...input.basis, quantity: input.package.quantity, unit } : input.basis;
  return { schemaVersion: 1, valueBasis: 'label', package: { quantity: input.package.quantity, unit }, basis: clone(labelBasis), factor: '1',
    required: clone(input.required), additional: clone(input.additional),
    source: clone({ basis: input.basis, required: input.required, additional: input.additional }) };
}
