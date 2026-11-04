import { act, create } from 'react-test-renderer';
import { AppState, Keyboard, TextInput } from 'react-native';
import App from '../App';

let renderer;

function byId(id) {
  return renderer.root.findAllByProps({ testID: id })[0];
}

beforeEach(async () => {
  await act(async () => { renderer = create(<App />); });
});

afterEach(async () => {
  await act(async () => { renderer.unmount(); });
  jest.restoreAllMocks();
});

test('login with empty fields opens an entirely blank screen and dismisses the keyboard', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  expect(byId('login-screen')).toBeDefined();
  await act(async () => { byId('login-button').props.onPress(); });
  expect(dismiss).toHaveBeenCalled();
  expect(byId('blank-screen')).toBeDefined();
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
  expect(byId('blank-screen')).toBeDefined();
  await act(async () => { renderer.unmount(); renderer = create(<App />); });
  expect(byId('login-screen')).toBeDefined();
  expect(byId('blank-screen')).toBeUndefined();
  expect(byId('username-input').props.value).toBe('');
  expect(byId('password-input').props.value).toBe('');
});

test('backgrounding does not register an automatic logout handler', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  await act(async () => { renderer.unmount(); renderer = create(<App />); });
  await act(async () => { byId('login-button').props.onPress(); });
  expect(listener.mock.calls.filter(([event]) => event === 'change')).toHaveLength(0);
  expect(byId('blank-screen')).toBeDefined();
});
