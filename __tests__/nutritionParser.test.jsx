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
