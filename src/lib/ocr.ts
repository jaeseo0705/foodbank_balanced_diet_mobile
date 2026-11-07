import { OcrError, type OcrAvailability, type OcrResult } from './ocr.types';

// Metro chooses ocr.ios.ts on iOS. Android/web stay usable until their OCR is connected.
export function getOcrAvailability(): OcrAvailability {
  return 'unsupported-platform';
}
export async function recognizeNutritionText(_uri: string): Promise<OcrResult> {
  throw new OcrError('unsupported-platform', '글자 읽기는 현재 iPhone 앱에서 지원합니다.');
}
