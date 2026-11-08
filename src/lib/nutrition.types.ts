export type NutritionValue = {
  code?: string;
  name: string;
  printedName?: string;
  value?: string;
  unit?: string;
  unitQualifier?: string;
  printedValue?: string;
  printedUnit?: string;
  state: 'exact' | 'explicit_zero' | 'bounded' | 'trace' | 'none_declared' | 'dash' | 'ambiguous' | 'not_detected' | 'conflict';
  operator?: 'lt' | 'lte' | 'gt' | 'gte';
  referencePercent?: string;
  needsReview: boolean;
  reviewReasons: string[];
  notices: string[];
  alternatives: { value: string; unit: string; label: string }[];
};

export type NutritionBasis = {
  type: 'total_package' | 'per_quantity' | 'per_serving' | 'per_unit' | 'per_daily_intake' | 'unknown';
  quantity?: string;
  unit?: string;
  count?: string;
  countUnit?: string;
  printedText?: string;
  needsReview: boolean;
  needsUnitWeight: boolean;
};

export type NutritionLabelResult = {
  package?: { quantity: string; unit: string };
  basis: NutritionBasis;
  required: NutritionValue[];
  additional: NutritionValue[];
  review: {
    unmatched: NutritionValue[];
    ambiguous: NutritionValue[];
    conflicts: NutritionValue[][];
    leftoverText: string[];
    notes: string[];
  };
};
