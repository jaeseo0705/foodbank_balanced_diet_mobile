import { getVisionModule } from '../modules/foodbank-vision-ocr';
import { getOcrAvailability, recognizeNutritionText } from '../src/lib/ocr.ios';
jest.mock('../modules/foodbank-vision-ocr', () => ({ getVisionModule: jest.fn() }));

beforeEach(() => { getVisionModule.mockReset(); });

test('an older binary or Expo Go reports that a rebuild is needed without crashing at import', async () => {
  getVisionModule.mockReturnValue(null);
  expect(getOcrAvailability()).toBe('rebuild-required');
  await expect(recognizeNutritionText('file:///label.jpg')).rejects.toMatchObject({ code: 'rebuild-required' });
});

test('the iOS adapter forwards a local URI and retains line positions/confidence', async () => {
  const result = { text: '나트륨 350mg', languages: ['ko-KR'], lines: [{ text: '나트륨 350mg', confidence: 0.8, bounds: { x: 0.1, y: 0.2, width: 0.5, height: 0.1 } }] };
  const recognize = jest.fn().mockResolvedValue(result);
  getVisionModule.mockReturnValue({ recognizeText: recognize });
  expect(getOcrAvailability()).toBe('ready');
  await expect(recognizeNutritionText('file:///label.jpg')).resolves.toEqual(result);
  expect(recognize).toHaveBeenCalledWith('file:///label.jpg');
});

test('remote URLs are never sent to the native OCR', async () => {
  const recognize = jest.fn();
  getVisionModule.mockReturnValue({ recognizeText: recognize });
  await expect(recognizeNutritionText('https://example.com/label.jpg')).rejects.toMatchObject({ code: 'invalid-image' });
  expect(recognize).not.toHaveBeenCalled();
});

test('native failures become a recoverable user message', async () => {
  getVisionModule.mockReturnValue({ recognizeText: jest.fn().mockRejectedValue(new Error('native error')) });
  await expect(recognizeNutritionText('file:///label.jpg')).rejects.toMatchObject({ code: 'recognition-failed' });
});
