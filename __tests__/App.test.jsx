import { act, create } from 'react-test-renderer';
import { AppState, Keyboard, Linking, Platform, TextInput } from 'react-native';
import App from '../App';
import * as ImagePicker from 'expo-image-picker';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  getPendingResultAsync: jest.fn(),
}));

let renderer;

function byId(id) {
  return renderer.root.findAllByProps({ testID: id })[0];
}

beforeEach(async () => {
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

test('login with empty fields opens task selection and dismisses the keyboard', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  expect(byId('login-screen')).toBeDefined();
  await act(async () => { byId('login-button').props.onPress(); });
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

test.each([true, false])('fresh app instance returns to login with keepLoggedIn=%s', async (keepLoggedIn) => {
  if (!keepLoggedIn) {
    await act(async () => { byId('keep-logged-in').props.onPress(); });
  }
  expect(byId('keep-logged-in').props.accessibilityState.checked).toBe(keepLoggedIn);
  await act(async () => {
    byId('username-input').props.onChangeText('test-user');
    byId('password-input').props.onChangeText('test-password');
  });
  await act(async () => { byId('login-button').props.onPress(); });
  expect(byId('task-selection-screen')).toBeDefined();
  await act(async () => { renderer.unmount(); renderer = create(<App />); });
  expect(byId('login-screen')).toBeDefined();
  expect(byId('task-selection-screen')).toBeUndefined();
  expect(byId('username-input').props.value).toBe('');
  expect(byId('password-input').props.value).toBe('');
});

test('backgrounding does not register an automatic logout handler', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  await act(async () => { renderer.unmount(); renderer = create(<App />); });
  await act(async () => { byId('login-button').props.onPress(); });
  expect(listener.mock.calls.filter(([event]) => event === 'change')).toHaveLength(0);
  expect(byId('task-selection-screen')).toBeDefined();
});

test.each([
  ['nutrition-registration', '영양성분 등록'],
  ['inventory', '재고 현황'],
  ['distribution', '배분 추천'],
  ['nutrition-calculation', '영양 계산'],
])('task %s opens its section and returns home', async (id, label) => {
  await act(async () => { byId('login-button').props.onPress(); });
  expect(byId('task-' + id).props.accessibilityLabel).toBe(label);
  await act(async () => { byId('task-' + id).props.onPress(); });
  expect(byId('section-screen')).toBeDefined();
  expect(byId('task-selection-screen')).toBeUndefined();
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('task-selection-screen')).toBeDefined();
});

test('profile settings returns to profile and logout clears the session', async () => {
  await act(async () => { byId('login-button').props.onPress(); });
  await act(async () => { byId('profile-button').props.onPress(); });
  const menu = (label) => renderer.root.findAllByProps({ accessibilityLabel: label })[0];
  expect(byId('profile-screen')).toBeDefined();
  await act(async () => { menu('설정').props.onPress(); });
  expect(byId('section-screen')).toBeDefined();
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('profile-screen')).toBeDefined();
  await act(async () => { menu('로그아웃').props.onPress(); });
  expect(byId('login-screen')).toBeDefined();
  await act(async () => { byId('login-button').props.onPress(); });
  expect(byId('task-selection-screen')).toBeDefined();
});

test.each(['manual'])('registration %s selection shows a dismissible preparation notice', async (method) => {
  await act(async () => { byId('login-button').props.onPress(); });
  await act(async () => { byId('task-nutrition-registration').props.onPress(); });
  expect(byId('nutrition-registration-screen')).toBeDefined();
  await act(async () => { byId('registration-' + method).props.onPress(); });
  expect(byId('registration-notice')).toBeDefined();
  await act(async () => { byId('registration-notice-close').props.onPress(); });
  await act(async () => { byId('back-button').props.onPress(); });
  expect(byId('task-selection-screen')).toBeDefined();
});

const sampleAsset = { uri: 'file:///nutrition.jpg', type: 'image', width: 1600, height: 1200 };

async function openRegistration() {
  await act(async () => { byId('login-button').props.onPress(); });
  await act(async () => { byId('task-nutrition-registration').props.onPress(); });
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
  expect(byId('task-selection-screen')).toBeDefined();
});
