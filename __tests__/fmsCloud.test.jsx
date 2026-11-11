import { createFmsClient } from '../src/lib/fmsCloud';
const session = (id = 'u1', expires_in = 3600) => ({ access_token: 'access-' + id, refresh_token: 'refresh-' + id, expires_in, user: { id } });
const respond = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
let previousFetch;
beforeEach(() => { previousFetch = global.fetch; global.fetch = jest.fn(); });
afterEach(() => { global.fetch = previousFetch; });
test('products are read only after login using the owner filter and products-only projection', async () => {
  const client = createFmsClient(jest.fn());
  global.fetch.mockResolvedValueOnce(respond(session())).mockResolvedValueOnce(respond([{ revision: 2, products: [{ id: 'p1', name: '쌀', barcode: '88001' }] }]));
  await client.signIn('test@example.com', 'password');
  expect(await client.loadProducts()).toEqual([expect.objectContaining({ id: 'p1', name: '쌀', workspaceUserId: 'u1' })]);
  const [url, options] = global.fetch.mock.calls[1];
  const parsed = new URL(url);
  expect(parsed.searchParams.get('select')).toBe('revision,products:payload->records->collections->products');
  expect(parsed.searchParams.get('user_id')).toBe('eq.u1');
  expect(options.headers.Authorization).toBe('Bearer access-u1');
  expect(global.fetch.mock.calls.every(([url]) => !url.includes('fms_save_state'))).toBe(true);
});
test('failed authentication does not grant product access', async () => {
  const expired = jest.fn(), client = createFmsClient(expired);
  global.fetch.mockResolvedValueOnce(respond({}, 400));
  await expect(client.signIn('wrong@example.com', 'wrong')).rejects.toThrow('이메일과 비밀번호');
  await expect(client.loadProducts()).rejects.toThrow('로그인');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
test('logout discards the session and prevents an in-flight reply being used', async () => {
  const client = createFmsClient(jest.fn());
  let finish;
  global.fetch.mockResolvedValueOnce(respond(session())).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await client.signIn('test@example.com', 'password');
  const reading = client.loadProducts();
  await Promise.resolve();
  client.clear();
  finish(respond([{ revision: 1, products: [] }]));
  await expect(reading).rejects.toThrow('로그인');
  await expect(client.loadProducts()).rejects.toThrow('로그인');
});
test('refresh cannot switch the active account', async () => {
  const expired = jest.fn(), client = createFmsClient(expired);
  global.fetch.mockResolvedValueOnce(respond(session('u1', 1))).mockResolvedValueOnce(respond(session('u2')));
  await client.signIn('test@example.com', 'password');
  await expect(client.loadProducts()).rejects.toThrow('계정');
  expect(expired).toHaveBeenCalledTimes(1);
});
test('an empty account returns an empty list and never creates sample records', async () => {
  const client = createFmsClient(jest.fn());
  global.fetch.mockResolvedValueOnce(respond(session())).mockResolvedValueOnce(respond([]));
  await client.signIn('test@example.com', 'password');
  expect(await client.loadProducts()).toEqual([]);
  expect(global.fetch.mock.calls[1][1].method).toBe('GET');
});
