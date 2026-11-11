import { makeManualNutrient } from './nutrientCatalog';
export type FmsFood = { id: string; name: string; workspaceUserId?: string; barcode?: string; category?: string; unit?: string; brand?: string };
export const isNutritionNumber = (value: string) => /^\d+(?:\.\d+)?$/.test(value.normalize('NFKC').trim());
export function missingRequiredNutrients(drafts: Record<string, string>) {
  return Array.from({ length: 9 }, (_, index) => `A00${index + 1}`)
    .filter(code => !isNutritionNumber(drafts[code] ?? ''))
    .map(code => makeManualNutrient(code)!.name);
}

