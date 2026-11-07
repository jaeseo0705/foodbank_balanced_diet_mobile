import { getVisionModule } from '../../modules/foodbank-vision-ocr';
import { OcrError, type OcrAvailability, type OcrResult } from './ocr.types';

export function getOcrAvailability(): OcrAvailability {
  return getVisionModule() ? 'ready' : 'rebuild-required';
}

export async function recognizeNutritionText(uri: string): Promise<OcrResult> {
  const module = getVisionModule();
  if (!module) throw new OcrError('rebuild-required', 'OCR을 사용하려면 최신 코드로 앱을 다시 빌드·설치해 주세요.');
  if (!uri.startsWith('file://')) throw new OcrError('invalid-image', '사진을 다시 선택해 주세요.');
  try {
    return await module.recognizeText(uri);
  } catch {
    throw new OcrError('recognition-failed', '사진의 글자를 읽지 못했습니다. 선명한 영양성분표 사진으로 다시 시도해 주세요.');
  }
}
