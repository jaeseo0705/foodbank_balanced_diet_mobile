import rules from '../data/korean_nutrition_rules_v1.json';
import type { NutritionValue } from './nutrition.types';

export type NutrientOption = { code: string; name: string; unit: string; unitQualifier?: string; aliases: string[] };

// One canonical dictionary for both the native parser and the picker. No copied category list.
export const nutrientCatalog: readonly NutrientOption[] = rules.nutrients.map(entry => ({
  code: entry.code, name: entry.name_ko, unit: entry.unit,
  unitQualifier: entry.unit_qualifier ?? undefined,
  aliases: entry.aliases.map(alias => alias.text),
})).sort((a, b) => a.name.localeCompare(b.name, 'ko'));

const normalize = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[\s·ㆍ-]/g, '');
export function searchNutrients(query: string): readonly NutrientOption[] {
  const key = normalize(query);
  return key ? nutrientCatalog.filter(entry => [entry.name, ...entry.aliases].some(name => normalize(name).includes(key))) : nutrientCatalog;
}

export function makeManualNutrient(code: string): NutritionValue | undefined {
  const entry = nutrientCatalog.find(entry => entry.code === code);
  if (!entry) return undefined;
  return {
    code: entry.code, name: entry.name, unit: entry.unit, unitQualifier: entry.unitQualifier,
    state: 'not_detected', needsReview: false, reviewReasons: [], notices: [], alternatives: [],
  };
}
