import { parseNutrition } from '../src/lib/nutritionParser';
import { nutritionRegex } from '../src/lib/nutritionRegex';
const label = ['영양정보 총 내용량 80 g 375 kcal', '총 내용량당', '나트륨 550 mg 28%', '탄수화물 58 g 18%', '당류 5 g 5%', '식이섬유 4.9 g 20%', '지방 16 g 30%', '트랜스지방 0 g', '포화지방 6 g 40%', '콜레스테롤 0 mg 0%', '단백질 2.8 g 5%'];
test('the reported label produces all core values and fiber through shared parsing', () => {
  const result = parseNutrition([], label.join('\n'));
  expect(result.package).toEqual({ quantity: '80', unit: 'g' });
  expect(result.basis.type).toBe('total_package');
  expect(result.required.map(v => v.value)).toEqual(['375', '550', '58', '5', '16', '0', '6', '0', '2.8']);
  expect(result.additional.find(v => v.code === 'D005').value).toBe('4.9');
  expect(result.required[1].referencePercent).toBe('28');
});
test('the same data with separate OCR text boxes is grouped into rows', () => {
  const lines = label.flatMap((text, i) => text.split(' ').map((word, j) => ({ text: word, confidence: 0.9, bounds: { x: j * 0.08, y: i * 0.06, width: 0.07, height: 0.025 } })));
  const result = parseNutrition(lines);
  expect(result.required.map(v => v.value)).toEqual(['375', '550', '58', '5', '16', '0', '6', '0', '2.8']);
});
test('mobile rules use numeric captures and explicit preceding character checks', () => {
  const pattern = nutritionRegex('(?<![0-9.])(?<num>\\d+)\\s*g');
  expect(pattern.source).not.toContain('(?<');
  expect(Array.from('1.2g 3g'.matchAll(pattern)).map(m => m.groups.num)).toEqual(['3']);
  expect('80g'.replace(nutritionRegex('(?<num>\\d+)g'), (...args) => args.at(-1).num)).toBe('80');
});

// Cases carried over from the removed Swift parser smoke test (scripts/nutrition-smoke).
const rowsToLines = rows => rows.map((text, i) => ({ text, confidence: 0.9, bounds: { x: 0.1, y: i * 0.045, width: 0.8, height: 0.02 } }));
const parseRows = rows => parseNutrition(rowsToLines(rows), rows.join('\n'));
const field = (result, code) => [...result.required, ...result.additional].find(v => v.code === code);

test('Swift-era sample label: values, package basis, percent and explicit zero', () => {
  const rows = ['영양정보', '총 내용량 80 g', '375 kcal', '총 내용량당', '1일 영양성분 기준치에 대한 비율', '나트륨 550 mg 28%', '탄수화물 58 g 18%', '당류 5 g 5%', '식이섬유 4.9 g 20%', '지방 16 g 30%', '트랜스지방 0 g', '포화지방 6 g 40%', '콜레스테롤 0 mg 0%', '단백질 2.8 g 5%', '1일 영양성분 기준치에 대한 비율(%)은 2,000 kcal 기준이므로 개인의 필요 열량에 따라 다를 수 있습니다.'];
  const result = parseRows(rows);
  const expected = { A001: '375', A002: '550', A003: '58', A004: '5', A005: '16', A006: '0', A007: '6', A008: '0', A009: '2.8', D005: '4.9' };
  for (const [code, value] of Object.entries(expected)) expect(field(result, code).value).toBe(value);
  expect(result.package?.quantity).toBe('80');
  expect(result.basis.quantity).toBe('80');
  expect(field(result, 'A002').referencePercent).toBe('28');
  expect(field(result, 'A006').state).toBe('explicit_zero');
});

test('Swift-era review rules: missing, split, units, conflict, bound, basis, unmatched, empty', () => {
  const missing = parseRows(['영양정보', '단백질 5 g']);
  expect(field(missing, 'A002').state).toBe('not_detected');
  expect(field(missing, 'A002').value).toBeUndefined();
  expect(field(parseRows(['영양정보', '나트륨', '550 mg 28%']), 'A002').value).toBe('550');
  const equivalent = parseRows(['영양정보', '총 내용량 80 g', '총 내용량당', '나트륨 0.55 g', '나트륨 550 mg']);
  expect(equivalent.review.conflicts).toHaveLength(0);
  expect(field(equivalent, 'A002')).toMatchObject({ value: '550', unit: 'mg' });
  expect(field(parseRows(['영양정보', '나트륨 550 mg', '나트륨 650 mg']), 'A002').state).toBe('conflict');
  expect(field(parseRows(['영양정보', '나트륨 5 mg 미만']), 'A002')).toMatchObject({ operator: 'lt', state: 'bounded' });
  expect(parseRows(['영양정보', '0 g당', '열량 300 kcal', '나트륨 550 mg']).basis.needsReview).toBe(true);
  const multi = parseRows(['영양정보', '100 g당 1회 제공량(30 g)당', '나트륨 500 mg 150 mg']);
  expect(multi.basis).toMatchObject({ type: 'unknown', needsReview: true });
  expect(parseRows(['영양정보', '새성분 3 mg']).review.unmatched[0].needsReview).toBe(true);
  expect(parseRows([]).required.every(v => v.value === undefined)).toBe(true);
});
