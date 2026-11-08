import { nutrientCatalog, makeManualNutrient, searchNutrients } from '../src/lib/nutrientCatalog';
import rules from '../src/data/korean_nutrition_rules_v1.json';

test('picker uses the canonical parser dictionary without invented categories', () => {
  expect(nutrientCatalog.map(x => x.code).sort()).toEqual(rules.nutrients.map(x => x.code).sort());
  expect(makeManualNutrient('unknown-code')).toBeUndefined();
  const fiber = makeManualNutrient('D005');
  expect(fiber).toMatchObject({ code: 'D005', name: '식이섬유', unit: 'g', state: 'not_detected' });
  expect(fiber.value).toBeUndefined();
});

test('search finds canonical names and aliases but never creates a result', () => {
  expect(searchNutrients('식이 섬유').map(x => x.code)).toContain('D005');
  expect(searchNutrients('나이아신').map(x => x.code)).toContain('B001');
  expect(searchNutrients('존재하지않는성분123')).toHaveLength(0);
  expect(searchNutrients('  ')).toHaveLength(rules.nutrients.length);
});
