import { describeNutritionBasis, orderNutritionValues } from '../src/lib/nutritionReview';

test.each([
  [{ type: 'total_package' }, '총 내용량당'],
  [{ type: 'per_quantity', quantity: '100', unit: 'g' }, '100 g당'],
  [{ type: 'per_serving', quantity: '30', unit: 'g' }, '1회 제공량(30 g)당'],
  [{ type: 'per_unit', count: '1', countUnit: '봉', quantity: '40', unit: 'g' }, '1봉(40 g)당'],
  [{ type: 'unknown' }, '확인 필요'],
])('basis is described without exposing an internal category menu: %j', (basis, expected) => {
  expect(describeNutritionBasis(basis)).toBe(expected);
});

test('fiber stays between sugars and fat as printed, and missing nutrients go last', () => {
  const item = (code, name) => ({ code, name, printedName: name });
  const result = { required: [item('A005', '지방'), item('A004', '당류'), item('A009', '단백질')], additional: [item('D005', '식이섬유')] };
  const lines = ['당류 5 g', '식이섬유 4.9 g', '지방 16 g'].map((text, i) => ({ text, bounds: { x: 0.1, y: i * 0.1, width: 0.8, height: 0.03 } }));
  expect(orderNutritionValues(result, lines).map(x => x.code)).toEqual(['A004', 'D005', 'A005', 'A009']);
  expect(result.required[0].code).toBe('A005');
});

test('nameless header calories retain their place above nutrient rows', () => {
  const result = { required: [{ code: 'A002', name: '나트륨' }, { code: 'A001', name: '열량', printedName: '(이름 없음)', printedValue: '375 kcal' }], additional: [] };
  const lines = ['375 kcal', '나트륨 550 mg'].map((text, i) => ({ text, bounds: { x: 0, y: i * 0.1, width: 1, height: 0.03 } }));
  expect(orderNutritionValues(result, lines).map(x => x.code)).toEqual(['A001', 'A002']);
});
