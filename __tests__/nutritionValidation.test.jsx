import { isNutritionNumber, missingRequiredNutrients } from '../src/lib/nutritionValidation';
import { createManualNutrition } from '../src/lib/manualNutrition';

test('mandatory numeric values include explicit zero, with no silent defaults', () => {
  const values = Object.fromEntries(createManualNutrition().required.map(item => [item.code, '0']));
  expect(missingRequiredNutrients(values)).toEqual([]);
  values.A003 = '';
  values.A004 = '5%';
  expect(missingRequiredNutrients(values)).toEqual(['탄수화물', '당류']);
});
test('number validation accepts decimal drafts and rejects incomplete or ambiguous values', () => {
  for (const value of ['0', '3', '4.9', ' 80 ', '３']) expect(isNutritionNumber(value)).toBe(true);
  for (const value of ['', ' ', '.', '1.', '-3', 'NaN', '1,234', '5%', 'Infinity']) expect(isNutritionNumber(value)).toBe(false);
});
