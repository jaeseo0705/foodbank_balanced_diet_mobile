import { requireOptionalNativeModule } from 'expo-modules-core';
import type { OcrResult } from '../../src/lib/ocr.types';

type VisionModule = { recognizeText(uri: string): Promise<OcrResult> };

// Optional lookup keeps Expo Go and older installed binaries from crashing at startup.
export function getVisionModule(): VisionModule | null {
  return requireOptionalNativeModule<VisionModule>('FoodbankVisionOCR');
}
