import { makeManualNutrient } from './nutrientCatalog';
import type { NutritionLabelResult, NutritionValue } from './nutrition.types';

export function createManualNutrition(): NutritionLabelResult {
  const required = ['A001', 'A002', 'A003', 'A004', 'A005', 'A006', 'A007', 'A008', 'A009']
    .map(makeManualNutrient).filter((value): value is NutritionValue => value !== undefined);
  return {
    basis: { type: 'unknown', needsReview: false, needsUnitWeight: false },
    required, additional: [],
    review: { unmatched: [], ambiguous: [], conflicts: [], leftoverText: [], notes: [] },
  };
}

export const publicFoodSearchUrl = 'https://various.foodsafetykorea.go.kr/nutrient/general/food/firstList.do';
