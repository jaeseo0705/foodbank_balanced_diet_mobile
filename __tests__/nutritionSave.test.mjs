import './loadTypescript.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { createFmsClient } = await import('../src/lib/fmsCloud.ts');
const { normalizeNutrition } = await import('../src/lib/nutritionNormalization.ts');
const entry = { code: 'A001', name: '열량', unit: 'kcal', state: 'exact', value: '200', needsReview: false, reviewReasons: [], notices: [], alternatives: [] };
const payload = { ...normalizeNutrition({ package: { quantity: '300', unit: 'g' }, basis: { type: 'per_quantity', quantity: '100', unit: 'g' }, required: [entry], additional: [] }), origin: 'reference', fmsUnit: '개', provenance: { publisher: '식품의약품안전처', version: '2026-10-29' } };
const food = { id: 'p1', name: '식품', unit: '개', workspaceUserId: 'u1', nutritionRevision: 0 };
const session = { access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600, user: { id: 'u1' } };
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

test('registration sends only the chosen product and whole-package normalized snapshot', async () => {
  const old = global.fetch, calls = [];
  global.fetch = async (url, options) => { calls.push([url, options]); return response(url.includes('/auth/') ? session : { nutrition_revision: 1, state_revision: 8 }); };
  try {
    const client = createFmsClient(() => {}); await client.signIn('x@y.z', 'pw');
    assert.equal(await client.saveNutrition(food, payload, 0), 1);
    const [url, options] = calls.at(-1), body = JSON.parse(options.body);
    assert.ok(url.endsWith('/rest/v1/rpc/fms_save_product_nutrition'));
    assert.equal(options.headers.Authorization, 'Bearer jwt');
    assert.equal(body.p_product_id, 'p1'); assert.equal(body.p_expected_unit, '개'); assert.equal(body.p_expected_nutrition_revision, 0);
    assert.equal(body.p_nutrition.required[0].value, '600');
    assert.equal(body.p_nutrition.source.required[0].value, '200');
    assert.equal(body.p_nutrition.provenance.publisher, '식품의약품안전처');
    assert.equal(body.p_nutrition.basis.type, 'total_package');
    assert.ok(!JSON.stringify(body).includes('donations'));
  } finally { global.fetch = old; }
});

test('another account and missing FMS unit cannot save', async () => {
  const old = global.fetch, calls = [];
  global.fetch = async (url) => { calls.push(url); return response(session); };
  try {
    const client = createFmsClient(() => {}); await client.signIn('x@y.z', 'pw');
    await assert.rejects(client.saveNutrition({ ...food, workspaceUserId: 'u2' }, payload, 0), /계정/);
    await assert.rejects(client.saveNutrition({ ...food, unit: '' }, payload, 0), /기준단위/);
    assert.equal(calls.length, 1);
  } finally { global.fetch = old; }
});

for (const [data, status, message] of [
  [{ message: 'FMS_NUTRITION_REVISION_CONFLICT' }, 409, /새로고침/],
  [{ message: 'FMS_PRODUCT_UNIT_CONFLICT' }, 409, /기준단위/],
  [{ message: 'FMS_PRODUCT_NOT_FOUND' }, 404, /물품/],
  [{ code: 'PGRST202' }, 404, /SQL/],
]) test(`save failure ${data.message || data.code} never reports success`, async () => {
  const old = global.fetch;
  global.fetch = async url => url.includes('/auth/') ? response(session) : response(data, status);
  try { const client = createFmsClient(() => {}); await client.signIn('x@y.z', 'pw'); await assert.rejects(client.saveNutrition(food, payload, 0), message); }
  finally { global.fetch = old; }
});

test('a save reply after logout is rejected', async () => {
  const old = global.fetch; let finish;
  global.fetch = async url => url.includes('/auth/') ? response(session) : new Promise(resolve => { finish = resolve; });
  try {
    const client = createFmsClient(() => {}); await client.signIn('x@y.z', 'pw');
    const pending = client.saveNutrition(food, payload, 0); await Promise.resolve(); client.clear(); finish(response({ nutrition_revision: 1 }));
    await assert.rejects(pending, /로그인/);
  } finally { global.fetch = old; }
});
