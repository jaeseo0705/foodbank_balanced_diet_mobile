import { act, create } from 'react-test-renderer';
import { AppState, Keyboard, Linking, Platform, TextInput } from 'react-native';
import App from '../App';
import * as ImagePicker from 'expo-image-picker';
import { recognizeNutritionText } from '../src/lib/ocr';
import { createFmsClient } from '../src/lib/fmsCloud';
import { OcrError } from '../src/lib/ocr.types';
jest.mock('../src/lib/ocr', () => ({ recognizeNutritionText: jest.fn() }));

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  getPendingResultAsync: jest.fn(),
}));

jest.mock('../src/lib/fmsCloud', () => ({ createFmsClient: jest.fn(() => ({
  signIn: jest.fn().mockResolvedValue(undefined), clear: jest.fn(),
  loadProducts: jest.fn().mockResolvedValue([
    { id: 'p1', name: '시험 물품', barcode: '880001', workspaceUserId: 'u1' },
    { id: 'p2', name: '다른 물품', barcode: '880002', workspaceUserId: 'u1' },
  ]),
})) }));
let renderer;
async function login() {
  await act(async () => {
    byId('username-input').props.onChangeText('test@example.com');
    byId('password-input').props.onChangeText('test-password');
  });
  await act(async () => { await byId('login-button').props.onPress(); });
}
async function openNutritionTask() {
  await act(async () => { byId('task-nutrition-registration').props.onPress(); });
  await act(async () => { byId('fms-product-p1').props.onPress(); });
}


function byId(id) {
  return renderer.root.findAllByProps({ testID: id })[0];
}

beforeEach(async () => {
  recognizeNutritionText.mockReset().mockResolvedValue({ text: '나트륨 350mg\n탄수화물 20g', lines: [], languages: ['ko-KR', 'en-US'] });
  ImagePicker.requestCameraPermissionsAsync.mockReset().mockResolvedValue({ granted: true, canAskAgain: true });
  ImagePicker.launchCameraAsync.mockReset().mockResolvedValue({ canceled: true, assets: null });
  ImagePicker.launchImageLibraryAsync.mockReset().mockResolvedValue({ canceled: true, assets: null });
  ImagePicker.getPendingResultAsync.mockReset().mockResolvedValue(null);
  await act(async () => { renderer = create(<App />); });
});

afterEach(async () => {
  await act(async () => { renderer.unmount(); });
  jest.restoreAllMocks();
});

test('authenticated login opens task selection and dismisses the keyboard', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  expect(byId('login-screen')).toBeDefined();
  await login();
  expect(dismiss).toHaveBeenCalled();
  expect(byId('task-selection-screen')).toBeDefined();
  expect(byId('login-screen')).toBeUndefined();
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
});

test('password visibility toggles without changing the entered password', async () => {
  await act(async () => { byId('password-input').props.onChangeText('sample password'); });
  expect(byId('password-input').props.secureTextEntry).toBe(true);
  await act(async () => { byId('password-visibility').props.onPress(); });
  expect(byId('password-input').props.secureTextEntry).toBe(false);
  expect(byId('password-input').props.value).toBe('sample password');
  await act(async () => { byId('password-visibility').props.onPress(); });
  expect(byId('password-input').props.secureTextEntry).toBe(true);
});

test('fresh app instance requires authentication and clears credentials', async () => {
  await login();
  expect(byId('task-selection-screen')).toBeDefined();
  await act(async () => { renderer.unmount(); renderer = create(<App />); });
  expect(byId('login-screen')).toBeDefined();
  expect(byId('task-selection-screen')).toBeUndefined();
  expect(byId('username-input').props.value).toBe('');
  expect(byId('password-input').props.value).toBe('');
  expect(byId('keep-logged-in')).toBeUndefined();
});

test('empty credentials and failed authentication do not open the workspace', async () => {
  await act(async () => { await byId('login-button').props.onPress(); });
  expect(byId('login-error')).toBeDefined();
  expect(byId('task-selection-screen')).toBeUndefined();
  const client = createFmsClient.mock.results.at(-1).value;
  client.signIn.mockRejectedValueOnce(new Error('로그인 실패'));
  await login();
  expect(byId('task-selection-screen')).toBeUndefined();
  expect(byId('login-error').props.children).toBe('로그인 실패');
});

test('backgrounding does not register an automatic logout handler', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  await act(async () => { renderer.unmount(); renderer = create(<App />); });
  await login();
  expect(listener.mock.calls.filter(([event]) => event === 'change')).toHaveLength(0);
  expect(byId('task-selection-screen')).toBeDefined();
});

test.each([
  ['nutrition-registration', '영양성분 등록'],
  ['inventory', '재고 현황'],
  ['distribution', '배분 추천'],
  ['nutrition-calculation', '영양 계산'],
])('task %s opens its section and returns home', async (id, label) => {
  await login();
  expect(byId('task-' + id).props.accessibilityLabel).toBe(label);
  await act(async () => { byId('task-' + id).props.onPress(); });
  expect(byId('section-screen')).toBeDefined();
  expect(byId('task-selection-screen')).toBeUndefined();
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('task-selection-screen')).toBeDefined();
});

test('profile settings returns to profile and logout clears the session', async () => {
  await login();
  await act(async () => { byId('profile-button').props.onPress(); });
  const menu = (label) => renderer.root.findAllByProps({ accessibilityLabel: label })[0];
  expect(byId('profile-screen')).toBeDefined();
  await act(async () => { menu('설정').props.onPress(); });
  expect(byId('section-screen')).toBeDefined();
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('profile-screen')).toBeDefined();
  await act(async () => { menu('로그아웃').props.onPress(); });
  expect(byId('login-screen')).toBeDefined();
  await login();
  expect(byId('task-selection-screen')).toBeDefined();
});

test('manual entry opens without a photo and starts every nutrient empty', async () => {
  await login();
  await openNutritionTask();
  const order = renderer.root.findAll(node => /^registration-(camera|photo|search|manual)$/.test(node.props.testID ?? '') && node.props.onPress).map(node => node.props.testID);
  expect([...new Set(order)]).toEqual(['registration-camera', 'registration-photo', 'registration-search', 'registration-manual']);
  await act(async () => { byId('registration-manual').props.onPress(); });
  expect(byId('manual-nutrition-screen')).toBeDefined();
  expect(byId('picked-nutrition-image')).toBeUndefined();
  expect(recognizeNutritionText).not.toHaveBeenCalled();
  for (let i = 1; i <= 9; i++) expect(byId('nutrition-value-A00' + i).props.value).toBe('');
  await act(async () => {
    byId('manual-package-quantity').props.onChangeText('80');
    byId('manual-basis-text').props.onChangeText('총 내용량당');
    byId('nutrition-value-A001').props.onChangeText('375');
  });
  expect(byId('manual-food-name')).toBeUndefined();
  expect(byId('fms-food-summary')).toBeDefined();
  expect(byId('nutrition-value-A001').props.value).toBe('375');
  expect(byId('nutrition-value-A002').props.placeholder ?? '').toBe('');
  await act(async () => { byId('manual-package-quantity').props.onChangeText('3'); });
  expect(byId('manual-package-quantity').props.value).toBe('3');
  await act(async () => { byId('manual-package-unit').props.onPress(); });
  await act(async () => { byId('manual-package-unit-kg').props.onPress(); });
  await act(async () => { byId('manual-package-unit').props.onPress(); });
  await act(async () => { byId('manual-package-unit-custom').props.onPress(); });
  await act(async () => { byId('manual-package-unit-custom-value').props.onChangeText('봉'); });
  expect(byId('manual-package-unit-custom-value').props.value).toBe('봉');
  await act(async () => { byId('manual-package-unit-apply').props.onPress(); });
  expect(byId('manual-package-unit-dialog')).toBeUndefined();
  await act(async () => { byId('manual-package-unit').props.onPress(); });
  await act(async () => { byId('manual-package-unit-custom').props.onPress(); });
  expect(byId('manual-package-unit-custom-value').props.value).toBe('봉');
  await act(async () => { byId('manual-package-unit-custom-value').props.onChangeText('취소할 단위'); });
  await act(async () => { byId('manual-package-unit-cancel').props.onPress(); });


  await act(async () => { byId('add-nutrient').props.onPress(); });
  await act(async () => { byId('nutrient-search').props.onChangeText('식이섬유'); });
  await act(async () => { byId('nutrient-option-D005').props.onPress(); });
  expect(byId('nutrition-value-D005').props.value).toBe('');
  await act(async () => { byId('register-nutrition').props.onPress(); });
  expect(byId('nutrition-register-notice')).toBeDefined();
  expect(byId('nutrition-registration-message').props.children).toContain('필수 영양성분');
  await act(async () => { byId('nutrition-register-close').props.onPress(); });
  await act(async () => {
    for (let i = 1; i <= 9; i++) byId('nutrition-value-A00' + i).props.onChangeText('0');
  });
  await act(async () => { byId('register-nutrition').props.onPress(); });
  expect(byId('nutrition-registration-message').props.children).toContain('입력값은 저장되지 않습니다');
  await act(async () => { byId('nutrition-register-close').props.onPress(); });

  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('nutrition-registration-screen')).toBeDefined();
  await act(async () => { byId('registration-manual').props.onPress(); });
  expect(byId('fms-food-summary')).toBeDefined();
  expect(byId('nutrition-value-A001').props.value).toBe('');
});

test('food search opens the official DB, handles link errors, and leads to reference entry', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  await login();
  await openNutritionTask();
  await act(async () => { byId('registration-search').props.onPress(); });
  expect(byId('food-search-screen')).toBeDefined();
  await act(async () => { byId('open-public-food-search').props.onPress(); });
  expect(byId('food-search-error')).toBeDefined();
  await act(async () => { byId('open-public-food-search').props.onPress(); });
  expect(open).toHaveBeenCalledWith('https://various.foodsafetykorea.go.kr/nutrient/general/food/firstList.do');
  expect(byId('food-search-error')).toBeUndefined();
  await act(async () => { byId('food-search-manual').props.onPress(); });
  expect(byId('manual-nutrition-screen')).toBeDefined();
  expect(byId('nutrition-value-A001').props.value).toBe('');
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('food-search-screen')).toBeDefined();
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('nutrition-registration-screen')).toBeDefined();
});

const sampleAsset = { uri: 'file:///nutrition.jpg', type: 'image', width: 1600, height: 1200 };

async function openRegistration() {
  await login();
  await openNutritionTask();
}

test.each(['camera', 'photo'])('%s returns an uncropped image preview that can be removed', async (method) => {
  const picker = method === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  picker.mockResolvedValue({ canceled: false, assets: [sampleAsset] });
  await openRegistration();
  await act(async () => { byId('registration-' + method).props.onPress(); });
  expect(picker).toHaveBeenCalledWith(expect.objectContaining({ mediaTypes: ['images'], allowsEditing: false, quality: 1 }));
  expect(ImagePicker.requestCameraPermissionsAsync).toHaveBeenCalledTimes(method === 'camera' ? 1 : 0);
  expect(byId('picked-nutrition-image').props.source.uri).toBe(sampleAsset.uri);
  expect(byId('picked-nutrition-image').props.resizeMode).toBe('contain');
  await act(async () => { byId('remove-nutrition-photo').props.onPress(); });
  expect(byId('picked-nutrition-image')).toBeUndefined();
});

test('canceling a replacement leaves the previous photo and returns to an enabled state', async () => {
  ImagePicker.launchImageLibraryAsync
    .mockResolvedValueOnce({ canceled: false, assets: [sampleAsset] })
    .mockResolvedValueOnce({ canceled: true, assets: null });
  await openRegistration();
  await act(async () => { byId('registration-photo').props.onPress(); });
  await act(async () => { byId('registration-photo').props.onPress(); });
  expect(byId('picked-nutrition-image').props.source.uri).toBe(sampleAsset.uri);
  expect(byId('registration-photo').props.disabled).toBe(false);
});

test.each([true, false])('camera denial handles canAskAgain=%s without launching camera', async (canAskAgain) => {
  ImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain });
  await openRegistration();
  await act(async () => { byId('registration-camera').props.onPress(); });
  expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  expect(byId('registration-notice')).toBeDefined();
  expect(Boolean(byId('camera-open-settings'))).toBe(!canAskAgain);
  if (!canAskAgain) {
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await act(async () => { byId('camera-open-settings').props.onPress(); });
    expect(open).toHaveBeenCalledTimes(1);
  }
  expect(byId('registration-camera').props.disabled).toBe(false);
});

test('picker failure allows the user to close the notice and try again', async () => {
  ImagePicker.launchImageLibraryAsync.mockRejectedValueOnce(new Error('picker unavailable'))
    .mockResolvedValueOnce({ canceled: false, assets: [sampleAsset] });
  await openRegistration();
  await act(async () => { byId('registration-photo').props.onPress(); });
  expect(byId('registration-notice')).toBeDefined();
  expect(byId('registration-photo').props.disabled).toBe(false);
  await act(async () => { byId('registration-notice-close').props.onPress(); });
  await act(async () => { byId('registration-photo').props.onPress(); });
  expect(byId('picked-nutrition-image').props.source.uri).toBe(sampleAsset.uri);
});

test('rapid repeated presses open only one picker', async () => {
  let finish;
  ImagePicker.launchImageLibraryAsync.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await openRegistration();
  await act(async () => {
    byId('registration-photo').props.onPress();
    byId('registration-photo').props.onPress();
  });
  expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
  expect(byId('registration-photo').props.disabled).toBe(true);
  await act(async () => { finish({ canceled: true, assets: null }); });
  expect(byId('registration-photo').props.disabled).toBe(false);
});

test('Android recovers the pending image result after activity recreation', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  ImagePicker.getPendingResultAsync.mockResolvedValue({ canceled: false, assets: [sampleAsset] });
  await openRegistration();
  expect(ImagePicker.getPendingResultAsync).toHaveBeenCalledTimes(1);
  expect(byId('picked-nutrition-image').props.source.uri).toBe(sampleAsset.uri);
});

test('back from a preview clears the image before leaving registration', async () => {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [sampleAsset] });
  await openRegistration();
  await act(async () => { byId('registration-photo').props.onPress(); });
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('picked-nutrition-image')).toBeUndefined();
  expect(byId('nutrition-registration-screen')).toBeDefined();
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('fms-product-picker')).toBeDefined();
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('task-selection-screen')).toBeDefined();
});

async function selectOcrPhoto() {
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [sampleAsset] });
  await openRegistration();
  await act(async () => { byId('registration-photo').props.onPress(); });
}

test('structured nutrition allows edits, keeps missing values empty, and clears with the photo', async () => {
  const entry = (code, name, value, state = 'exact') => ({ code, name, value, unit: 'mg', state,
    needsReview: state !== 'exact', reviewReasons: [], notices: [], alternatives: [] });
  recognizeNutritionText.mockResolvedValue({ text: '나트륨 550 mg', lines: [], languages: ['ko-KR'], nutrition: {
    package: { quantity: '80', unit: 'g' },
    basis: { type: 'total_package', quantity: '80', unit: 'g', needsReview: false, needsUnitWeight: false },
    required: [entry('A002', '나트륨', '550'), entry('A008', '콜레스테롤', undefined, 'not_detected'), entry('A009', '단백질', '5', 'conflict')],
    additional: [], review: { unmatched: [], ambiguous: [], conflicts: [], leftoverText: [], notes: [] },
  } });
  await selectOcrPhoto();
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  expect(byId('nutrition-value-A002').props.value).toBe('550');
  expect(byId('nutrition-value-A008').props.value).toBe('');
  expect(byId('nutrition-value-A009').props.value).toBe('');
  expect(renderer.root.findAllByProps({ accessibilityLabel: '총 내용량당' })).toHaveLength(0);
  await act(async () => { byId('nutrition-edit-basis').props.onPress(); });
  await act(async () => { byId('nutrition-basis-text').props.onChangeText('100 g당'); });
  await act(async () => { byId('nutrition-basis-apply').props.onPress(); });
  expect(byId('nutrition-basis-summary').props.children).toEqual(['영양정보 기준: ', '100 g당']);
  expect(byId('nutrition-value-A002').props.value).toBe('550');
  await act(async () => { byId('register-nutrition').props.onPress(); });
  expect(byId('nutrition-register-notice')).toBeDefined();
  expect(renderer.root.findAllByProps({ visible: true }).length).toBeGreaterThan(0);
  await act(async () => { byId('nutrition-register-close').props.onPress(); });

  await act(async () => { byId('nutrition-value-A002').props.onChangeText('560'); });
  expect(byId('nutrition-value-A002').props.value).toBe('560');
  await act(async () => { byId('nutrition-value-A002').props.onChangeText('56%'); });
  expect(byId('nutrition-value-A002').props.value).toBe('56%');
  expect(byId('ocr-text')).toBeUndefined();
  await act(async () => { byId('remove-nutrition-photo').props.onPress(); });
  expect(byId('nutrition-review')).toBeUndefined();
});

test('photo nutrition values are locked until 수정 is pressed, and 취소 returns to the start', async () => {
  recognizeNutritionText.mockResolvedValue({ text: '나트륨 550 mg', lines: [], languages: ['ko-KR'], nutrition: {
    basis: { type: 'total_package', quantity: '80', unit: 'g', needsReview: false, needsUnitWeight: false },
    required: [{ code: 'A002', name: '나트륨', value: '550', unit: 'mg', state: 'exact', needsReview: false, reviewReasons: [], notices: [], alternatives: [] }],
    additional: [], review: { unmatched: [], ambiguous: [], conflicts: [], leftoverText: [], notes: [] },
  } });
  await selectOcrPhoto();
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  expect(byId('nutrition-value-A002').props.editable).toBe(false);
  await act(async () => { byId('nutrition-edit-basis').props.onPress(); });
  await act(async () => { byId('nutrition-basis-apply').props.onPress(); });
  expect(byId('nutrition-value-A002').props.editable).toBe(true);
  await act(async () => { byId('nutrition-edit-basis').props.onPress(); });
  expect(byId('nutrition-value-A002').props.editable).toBe(false);
  expect(byId('cancel-nutrition')).toBeDefined();
  await act(async () => { byId('cancel-nutrition').props.onPress(); });
  expect(byId('nutrition-review')).toBeUndefined();
  expect(byId('picked-nutrition-image')).toBeUndefined();
});

test('OCR reads the photo without exposing its raw text', async () => {
  await selectOcrPhoto();
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  expect(recognizeNutritionText).toHaveBeenCalledWith(sampleAsset.uri);
  expect(byId('ocr-text')).toBeUndefined();
  expect(byId('read-nutrition-text').props.disabled).toBe(false);
});

test('empty OCR results show a retry message instead of zero nutrition values', async () => {
  recognizeNutritionText.mockResolvedValue({ text: '', lines: [], languages: ['ko-KR'] });
  await selectOcrPhoto();
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  expect(byId('ocr-empty')).toBeDefined();
  expect(byId('ocr-text')).toBeUndefined();
});

test('OCR failure and missing native module can be dismissed and retried', async () => {
  recognizeNutritionText.mockRejectedValueOnce(new OcrError('rebuild-required', '앱을 다시 빌드·설치해 주세요.'))
    .mockResolvedValueOnce({ text: '단백질 5g', lines: [], languages: ['ko-KR'] });
  await selectOcrPhoto();
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  expect(byId('registration-notice')).toBeDefined();
  expect(byId('read-nutrition-text').props.disabled).toBe(false);
  await act(async () => { byId('registration-notice-close').props.onPress(); });
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  expect(byId('ocr-text')).toBeUndefined();
});

test('repeated OCR presses launch one request', async () => {
  let finish;
  recognizeNutritionText.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await selectOcrPhoto();
  await act(async () => {
    byId('read-nutrition-text').props.onPress();
    byId('read-nutrition-text').props.onPress();
  });
  expect(recognizeNutritionText).toHaveBeenCalledTimes(1);
  expect(byId('read-nutrition-text').props.disabled).toBe(true);
  await act(async () => { finish({ text: '나트륨 350mg', lines: [], languages: ['ko-KR'] }); });
  expect(byId('ocr-result')).toBeDefined();
});

test.each(['replace', 'remove'])('old OCR replies are ignored after photo %s', async (action) => {
  let finish;
  recognizeNutritionText.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  await selectOcrPhoto();
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  if (action === 'replace') {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ ...sampleAsset, uri: 'file:///new-photo.jpg' }] });
    await act(async () => { byId('registration-photo').props.onPress(); });
  } else {
    await act(async () => { byId('remove-nutrition-photo').props.onPress(); });
  }
  await act(async () => { finish({ text: 'OLD RESULT', lines: [], languages: ['ko-KR'] }); });
  expect(byId('ocr-result')).toBeUndefined();
});

test('a new photo clears an already displayed OCR result', async () => {
  await selectOcrPhoto();
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ ...sampleAsset, uri: 'file:///replacement.jpg' }] });
  await act(async () => { byId('registration-photo').props.onPress(); });
  expect(byId('ocr-result')).toBeUndefined();
  expect(byId('picked-nutrition-image').props.source.uri).toBe('file:///replacement.jpg');
});

test('a missed nutrient is selected from the dictionary, edited, deduplicated, and cleared with the photo', async () => {
  recognizeNutritionText.mockResolvedValue({ text: '나트륨 550 mg', lines: [], languages: ['ko-KR'], nutrition: {
    basis: { type: 'total_package', quantity: '80', unit: 'g', needsReview: false, needsUnitWeight: false },
    required: [{ code: 'A002', name: '나트륨', value: '550', unit: 'mg', state: 'exact', needsReview: false, reviewReasons: [], notices: [], alternatives: [] }],
    additional: [], review: { unmatched: [], ambiguous: [], conflicts: [], leftoverText: [], notes: [] },
  } });
  await selectOcrPhoto();
  await act(async () => { byId('read-nutrition-text').props.onPress(); });
  await act(async () => { byId('add-nutrient').props.onPress(); });
  await act(async () => { byId('nutrient-search').props.onChangeText('없는성분123'); });
  expect(byId('nutrient-search-empty')).toBeDefined();
  expect(renderer.root.findAllByProps({ accessibilityLabel: '새 성분 만들기' })).toHaveLength(0);
  await act(async () => { byId('nutrient-search').props.onChangeText('식이 섬유'); });
  await act(async () => { byId('nutrient-option-D005').props.onPress(); });
  expect(byId('nutrient-picker')).toBeUndefined();
  expect(byId('nutrition-value-D005').props.value).toBe('');
  await act(async () => { byId('nutrition-value-D005').props.onChangeText('4.9'); });
  expect(byId('nutrition-value-D005').props.value).toBe('4.9');
  await act(async () => { byId('move-up-D005').props.onPress(); });
  expect(renderer.root.findAll(node => node.type === TextInput && /^nutrition-value-/.test(node.props.testID ?? '')).map(node => node.props.testID)).toEqual(['nutrition-value-D005', 'nutrition-value-A002']);
  expect(byId('nutrition-value-D005').props.value).toBe('4.9');
  expect(byId('move-up-D005').props.disabled).toBe(true);
  await act(async () => { byId('add-nutrient').props.onPress(); });
  await act(async () => { byId('nutrient-search').props.onChangeText('식이섬유'); });
  expect(byId('nutrient-option-D005').props.disabled).toBe(true);
  await act(async () => { byId('nutrient-search').props.onChangeText('나트륨'); });
  expect(byId('nutrient-option-A002').props.disabled).toBe(true);
  await act(async () => { byId('nutrient-picker-close').props.onPress(); });
  expect(byId('nutrition-value-D005').props.value).toBe('4.9');
  await act(async () => { byId('remove-added-D005').props.onPress(); });
  expect(byId('nutrition-value-D005')).toBeUndefined();
  await act(async () => { byId('add-nutrient').props.onPress(); });
  await act(async () => { byId('nutrient-search').props.onChangeText('식이섬유'); });
  expect(byId('nutrient-option-D005').props.disabled).toBe(false);
  await act(async () => { byId('nutrient-option-D005').props.onPress(); });
  await act(async () => { byId('remove-nutrition-photo').props.onPress(); });
  expect(byId('nutrition-review')).toBeUndefined();
  expect(byId('nutrition-value-D005')).toBeUndefined();
});


test('changing the selected FMS product preserves manual nutrient edits', async () => {
  await openRegistration();
  await act(async () => { byId('registration-manual').props.onPress(); });
  await act(async () => { byId('nutrition-value-A001').props.onChangeText('375'); });
  await act(async () => { byId('change-fms-food').props.onPress(); });
  await act(async () => { byId('fms-product-p2').props.onPress(); });
  expect(byId('nutrition-value-A001').props.value).toBe('375');
  expect(byId('fms-food-summary')).toBeDefined();
});
