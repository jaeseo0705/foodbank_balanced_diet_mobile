import { publicFoodCells, publicFoodNutrition, readPublicFoods } from '../src/lib/publicFood';
import foods from './fixtures/publicFoods.json';
const value = (result, code) => [...result.required, ...result.additional].find(v => v.code === code);

test.each(foods)('$source_key uses its actual header rows and preserves every source cell', food => {
  expect(readPublicFoods([food])).toEqual([food]);
  const cells = publicFoodCells(food), result = publicFoodNutrition(food);
  expect(Object.fromEntries(cells.map(c => [c.column, c.value]))).toEqual(food.raw_values);
  expect(value(result, 'A001').unit).toBe('kcal');
  expect(value(result, 'A001').value).toBe(food.raw_values[food.source_key === 'rda' ? 'F' : food.source_key === 'nifs' ? 'G' : food.source_key === 'mfds_supplement' ? 'S' : 'R']);
  expect(value(result, 'A009').unit).toBe('g');
  expect(result.basis.printedText).toBe(`${food.basis}당`);
});

test('missing, zero, trace, dash, ranges and unsupported units never become interchangeable', () => {
  const food = { ...foods[0], headers: { rows: { 1: { A: '에너지(kcal)', B: '당류(g)', C: '지방(g)', D: '나트륨(mg)', E: '단백질(g)', F: '칼슘(IU)' } } },
    raw_values: { A: '0.00', B: 'Tr', C: '-', D: '<0.5', E: '', F: '100' } };
  const result = publicFoodNutrition(food);
  expect(value(result, 'A001')).toMatchObject({ value: '0.00', state: 'explicit_zero' });
  expect(value(result, 'A004')).toMatchObject({ state: 'trace', printedValue: 'Tr' });
  expect(value(result, 'A004').value).toBeUndefined();
  expect(value(result, 'A005').state).toBe('dash');
  expect(value(result, 'A002')).toMatchObject({ state: 'bounded', operator: 'lt', value: '0.5' });
  expect(value(result, 'A009').value).toBeUndefined();
  expect(value(result, 'F013')).toBeUndefined();
  expect(value(result, 'A008')).toMatchObject({ state: 'not_detected', needsReview: true });
});

test('seafood fatty acids retain mg, not the canonical g unit; RDA uses separate units row', () => {
  const seafood = publicFoodNutrition(foods.find(f => f.source_key === 'nifs'));
  expect(value(seafood, 'A007')).toMatchObject({ unit: 'mg', value: '446.12' });
  expect(value(seafood, 'A006')).toMatchObject({ unit: 'mg', value: '3.22' });
  const rda = publicFoodNutrition(foods.find(f => f.source_key === 'rda'));
  expect(value(rda, 'A002').unit).toBe('mg');
  expect(value(rda, 'A007').unit).toBe('g');
  expect(value(rda, 'A008').unit).toBe('mg');
});

test('qualifiers come from the source, and duplicate aliases require review', () => {
  const source = { ...foods[0], headers: { rows: { 1: { A: '비타민 A(μg RAE)', B: '니아신(mg)', C: '지방(g)', D: '지방(mg)' } } }, raw_values: { A: '50', B: '1', C: '2', D: '2000' } };
  const result = publicFoodNutrition(source);
  expect(value(result, 'C001')).toMatchObject({ value: '50', unitQualifier: 'RAE' });
  expect(value(result, 'B001').unitQualifier).toBeUndefined();
  expect(value(result, 'A005')).toMatchObject({ state: 'conflict', needsReview: true });
  expect(value(result, 'A005').value).toBeUndefined();
});

test('malformed RPC results are rejected, not treated as empty success', () => {
  expect(() => readPublicFoods({ error: 'bad' })).toThrow('형식');
  expect(() => readPublicFoods([{ ...foods[0], raw_values: null }])).toThrow('형식');
  expect(() => readPublicFoods([{ ...foods[0], headers: { rows: { 1: null } } }])).toThrow('형식');
  expect(readPublicFoods([])).toEqual([]);
});
