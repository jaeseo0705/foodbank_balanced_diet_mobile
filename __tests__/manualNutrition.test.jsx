import { createManualNutrition } from '../src/lib/manualNutrition';

test('manual entry creates fresh empty core fields with dictionary names and units', () => {
  const a = createManualNutrition(), b = createManualNutrition();
  expect(a.required).toHaveLength(9);
  expect(a.required.every(x => x.value === undefined)).toBe(true);
  expect(a.required.find(x => x.code === 'A002')).toMatchObject({ name: '나트륨', unit: 'mg' });
  expect(a.required.find(x => x.code === 'A001')).toMatchObject({ name: '열량', unit: 'kcal' });
  a.required[0].value = '100';
  expect(b.required[0].value).toBeUndefined();
  expect(a.basis.type).toBe('unknown');
});
