import type { NutritionLabelResult } from './nutrition.types';

export type OcrLine = {
  text: string;
  confidence: number;
  bounds: { x: number; y: number; width: number; height: number };
};
export type OcrResult = { text: string; lines: OcrLine[]; languages: string[]; nutrition?: NutritionLabelResult; nutritionError?: string };
export type OcrAvailability = 'ready' | 'rebuild-required' | 'unsupported-platform';

export class OcrError extends Error {
  constructor(public readonly code: 'rebuild-required' | 'unsupported-platform' | 'invalid-image' | 'recognition-failed', message: string) {
    super(message);
    this.name = 'OcrError';
  }
}
