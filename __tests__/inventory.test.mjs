import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { buildInventory, inventoryCollections } from '../src/lib/fmsInventory.ts';

const blank = () => ({ ...Object.fromEntries(inventoryCollections.map(key => [key, []])), products: [
  { id: 'p1', name: '쌀', barcode: '880001', unit: '개', category: '곡류' },
  { id: 'p2', name: '소포장 쌀', unit: '봉' }, { id: 'p3', name: '꾸러미', unit: '개' },
] });
const quantities = db => buildInventory(db).map(item => item.quantity);
test('empty stock does not invent quantities; invalid data is rejected', () => {
  assert.deepEqual(quantities(blank()), [0, 0, 0]);
  assert.throws(() => buildInventory({ products: [] }), /자료 형식/);
  const db = blank(); db.donations = [{ items: [{ productId: 'missing', quantity: 10 }] }];
  assert.throws(() => buildInventory(db), /물품 정보/);
  db.donations = [{ items: [{ productId: 'p1', quantity: 'invalid' }] }];
  assert.throws(() => buildInventory(db), /수량/);
});
test('intake, provision, disposal, adjustments, and cancellation match FMS', () => {
  const db = blank();
  db.donations = [{ items: [{ productId: 'p1', quantity: '20' }] }, { status: '취소', items: [{ productId: 'p1', quantity: 90 }] }];
  db.provisions = [{ items: [{ productId: 'p1', quantity: 4 }] }];
  db.disposals = [{ items: [{ productId: 'p1', quantity: 2 }] }];
  db.adjustments = [{ productId: 'p1', quantity: -1 }, { status: '취소', productId: 'p1', quantity: 10 }];
  assert.deepEqual(quantities(db), [13, 0, 0]);
  assert.equal(buildInventory(db)[0].barcode, '880001');
  db.receipts = [{ items: [{ productId: 'p1', quantity: 99 }] }];
  db.stockMovements = [{ productId: 'p1', quantity: 3, fromLocation: 'A', toLocation: 'B' }];
  assert.deepEqual(quantities(db), [13, 0, 0]);
});
test('only confirmed incoming transfers count, outgoing transfers reduce stock', () => {
  const db = blank();
  db.transfers = [
    { direction: 'in', status: '요청', items: [{ productId: 'p1', quantity: 100 }] },
    { direction: 'in', status: '확정', items: [{ productId: 'p1', quantity: 12 }] },
    { direction: 'out', items: [{ productId: 'p1', quantity: 2 }] },
    { direction: 'out', status: '취소', items: [{ productId: 'p1', quantity: 3 }] },
  ];
  assert.deepEqual(quantities(db), [10, 0, 0]);
});
test('splitting and set creation consume ingredients and produce output', () => {
  const db = blank();
  db.donations = [{ items: [{ productId: 'p1', quantity: 10 }] }];
  db.splits = [{ productId: 'p1', quantity: 2, targetProductId: 'p2', targetQuantity: 8 }];
  db.sets = [{ productId: 'p3', quantity: 2, items: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 2 }] }];
  assert.deepEqual(quantities(db), [6, 4, 2]);
});
test('decimal quantities are rounded as in FMS', () => {
  const db = blank();
  db.adjustments = [{ productId: 'p1', quantity: 0.1 }, { productId: 'p1', quantity: 0.2 }];
  assert.equal(buildInventory(db)[0].quantity, 0.3);
});

// Load the actual client without Expo/Jest; all HTTP below is a test double.
const inventoryUrl = new URL('../src/lib/fmsInventory.ts', import.meta.url).href;
const source = stripTypeScriptTypes(await readFile(new URL('../src/lib/fmsCloud.ts', import.meta.url), 'utf8'))
  .replace("from './fmsInventory'", `from '${inventoryUrl}'`);
const { createFmsClient } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const session = { access_token: 'access-u1', refresh_token: 'refresh-u1', expires_in: 3600, user: { id: 'u1' } };
test('inventory requests require login, use owner filter and are read-only', async () => {
  const previous = globalThis.fetch, calls = [];
  const db = blank(); db.adjustments = [{ productId: 'p1', quantity: 3 }];
  globalThis.fetch = async (url, options) => { calls.push([url, options]); return response(url.includes('/auth/') ? session : [{ revision: 2, ...db }]); };
  try {
    const client = createFmsClient(() => {});
    await assert.rejects(client.loadInventory(), /로그인/);
    assert.equal(calls.length, 0);
    await client.signIn('test@example.com', 'password');
    assert.equal((await client.loadInventory())[0].quantity, 3);
    const [url, options] = calls[1], params = new URL(url).searchParams;
    assert.equal(params.get('user_id'), 'eq.u1');
    assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, 'Bearer access-u1');
    assert.equal(params.get('select'), ['revision', ...inventoryCollections.map(key => `${key}:payload->records->collections->${key}`)].join(','));
    client.clear(); await assert.rejects(client.loadInventory(), /로그인/);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = previous; }
});
test('late inventory reply after logout cannot populate another session', async () => {
  const previous = globalThis.fetch; let finish;
  globalThis.fetch = async url => url.includes('/auth/') ? response(session) : new Promise(resolve => { finish = resolve; });
  try {
    const client = createFmsClient(() => {});
    await client.signIn('test@example.com', 'password');
    const reading = client.loadInventory(); await Promise.resolve();
    client.clear(); finish(response([{ revision: 1, ...blank() }]));
    await assert.rejects(reading, /로그인/);
  } finally { globalThis.fetch = previous; }
});
test('empty accounts and denied access are handled', async () => {
  const previous = globalThis.fetch; let status = 200;
  globalThis.fetch = async url => url.includes('/auth/') ? response(session) : response([], status);
  try {
    const client = createFmsClient(() => {}); await client.signIn('test@example.com', 'password');
    assert.deepEqual(await client.loadInventory(), []);
    status = 403; await assert.rejects(client.loadInventory(), /권한/);
  } finally { globalThis.fetch = previous; }
});
