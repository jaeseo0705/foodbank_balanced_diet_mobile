import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:8080';
const server = spawn('python3', ['-m', 'http.server', '8080', '--bind', '127.0.0.1', '--directory', 'dist'], { stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) break;
    } catch {}
    if (attempt >= 40) throw new Error('Web preview server did not start');
    await setTimeout(100);
  }
  await mkdir('qa-output', { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  // Network fixtures exercise authentication and product selection without production credentials.
  await page.route('https://aqbmgufdixxhvtmmrwyp.supabase.co/**', async route => {
    const url = route.request().url();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'apikey,content-type,authorization', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    const body = url.includes('/auth/v1/token') ? { access_token: 'fixture-access', refresh_token: 'fixture-refresh', expires_in: 3600, user: { id: 'fixture-user' } }
      : [{ revision: 1, products: [{ id: 'p1', name: '시험 물품', barcode: '880001', category: '식품', unit: '개' }] }];
    await route.fulfill({ status: 200, headers, contentType: 'application/json', body: JSON.stringify(body) });
  });
  async function login() {
    await page.getByTestId('username-input').fill('test@example.com');
    await page.getByTestId('password-input').fill('test-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByTestId('task-selection-screen').waitFor();
  }
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  async function checkTasks() {
    const ids = ['nutrition-registration', 'inventory', 'distribution', 'nutrition-calculation'];
    const boxes = await Promise.all(ids.map((id) => page.getByTestId('task-' + id).boundingBox()));
    assert.ok(boxes.every(Boolean), 'All four task cards must be visible');
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      assert.ok(box.x >= page.viewportSize().width * 0.06, 'Cards leave side margins');
      assert.ok(box.x + box.width <= page.viewportSize().width * 0.94, 'Cards leave right margin');
      assert.ok(box.width > box.height * 1.8, 'Cards are horizontal');
      if (i > 0) {
        assert.ok(box.y > boxes[i - 1].y + boxes[i - 1].height, 'Four separate rows');
        assert.ok(Math.abs(box.x - boxes[0].x) < 1, 'Rows share their left edge');
      }
      const icon = await page.getByTestId('icon-' + ids[i]).boundingBox();
      const label = await page.getByTestId('label-' + ids[i]).boundingBox();
      assert.ok(icon && label);
      const center = box.y + box.height / 2;
      assert.ok(Math.abs(icon.y + icon.height / 2 - center) < 2, 'Icon is vertically centered');
      assert.ok(Math.abs(label.y + label.height / 2 - center) < 2, 'Label is vertically centered');
      assert.ok(label.x > icon.x + icon.width, 'Icon and label have a clear gap');
      const text = page.getByTestId('label-' + ids[i]);
      const typography = await text.evaluate((element) => {
        const style = getComputedStyle(element);
        return { align: style.textAlign, lineHeight: parseFloat(style.lineHeight) };
      });
      assert.equal(typography.align, 'left', 'Labels keep the approved horizontal alignment');
      assert.ok(label.height <= typography.lineHeight + 1, 'Task names fit on one line');
      assert.ok(label.x + label.width < box.x + box.width, 'Label stays inside card');
    }
  }
  async function checkRegistration(name, preview = false) {
    await page.getByTestId('task-nutrition-registration').click();
    await page.getByTestId('fms-product-p1').click();
    await page.getByTestId('nutrition-registration-screen').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const screenshot = await page.screenshot({ path: 'qa-output/nutrition-registration-' + name + '.png', fullPage: true });
    if (preview && process.env.QA_PREVIEW_LOG === '1') console.log('QA_REGISTRATION_START' + screenshot.toString('base64') + 'QA_REGISTRATION_END');
    for (const method of ['camera', 'photo', 'search', 'manual']) {
      const button = page.getByTestId('registration-' + method);
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= page.viewportSize().width, 'Registration actions remain inside the screen');
      if (method === 'manual') {
        await button.click();
        await page.getByTestId('manual-nutrition-screen').waitFor();
        await page.getByTestId('fms-food-summary').waitFor();
        await page.getByTestId('manual-package-quantity').fill('3');
        assert.equal(await page.getByTestId('manual-package-quantity').inputValue(), '3');
        const quantityBox = await page.getByTestId('manual-package-quantity').boundingBox();
        const unitBox = await page.getByTestId('manual-package-unit').boundingBox();
        assert.ok(quantityBox && unitBox && Math.abs(quantityBox.y - unitBox.y) < 4, 'Quantity and unit share one row');
        assert.ok(unitBox.width <= 110, 'Unit selector remains compact');
        await page.getByTestId('manual-package-unit').click();
        await page.getByTestId('manual-package-unit-dialog').waitFor();
        await page.getByTestId('manual-package-unit-kg').click();
        assert.equal(await page.getByTestId('manual-package-unit-dialog').count(), 0);
        assert.equal((await page.getByTestId('manual-package-unit').innerText()).replace(/\s/g, ''), 'kg▾');
        await page.getByTestId('manual-basis-text').fill('100 g당');
        await page.getByTestId('nutrition-value-A001').fill('100');
        assert.equal(await page.getByTestId('nutrition-value-A001').inputValue(), '100');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: 'qa-output/manual-nutrition-' + name + '.png', fullPage: true });
        await page.getByTestId('register-nutrition').scrollIntoViewIfNeeded();
        await page.getByTestId('register-nutrition').click();
        await page.getByTestId('nutrition-register-notice').waitFor();
        await page.getByTestId('nutrition-register-close').click();
        await page.getByRole('button', { name: '뒤로', exact: true }).click();
      } else if (method === 'search') {
        await button.click();
        await page.getByTestId('food-search-screen').waitFor();
        assert.equal(await page.getByTestId('open-public-food-search').count(), 1);
        await page.screenshot({ path: 'qa-output/food-search-' + name + '.png', fullPage: true });
        await page.getByTestId('food-search-manual').click();
        await page.getByTestId('manual-nutrition-screen').waitFor();
        await page.getByRole('button', { name: '뒤로', exact: true }).click();
        await page.getByTestId('food-search-screen').waitFor();
        await page.getByRole('button', { name: '뒤로', exact: true }).click();
      } else {
        const chooserPromise = page.waitForEvent('filechooser');
        await button.click();
        const chooser = await chooserPromise;
        await chooser.setFiles({
          name: 'nutrition-label.png',
          mimeType: 'image/png',
          buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABgCAIAAAAip+O/AAAAgElEQVR4nO3PQQ0AIBDAMMC/50MEj4ZkVbDtmVk/OzrgVQNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA9oFu4MDvZRMYK4AAAAASUVORK5CYII=', 'base64'),
        });
        await page.getByTestId('picked-nutrition-image').waitFor();
        await page.getByTestId('read-nutrition-text').click();
        await page.getByTestId('registration-notice').waitFor();
        assert.match(await page.getByTestId('registration-notice').innerText(), /iPhone/);
        await page.getByTestId('registration-notice-close').click();
        await page.getByTestId('remove-nutrition-photo').click();
        assert.equal(await page.getByTestId('picked-nutrition-image').count(), 0);
      }
    }
    await page.getByRole('button', { name: '뒤로', exact: true }).click();
    await page.getByTestId('fms-product-picker').waitFor();
    await page.getByRole('button', { name: '뒤로', exact: true }).click();
    await page.getByTestId('task-selection-screen').waitFor();
  }
  await page.goto(baseUrl);
  await page.getByTestId('login-screen').waitFor();
  const loginPreview = await page.screenshot({ path: 'qa-output/login-phone.png', fullPage: true });
  if (process.env.QA_PREVIEW_LOG === '1') console.log('QA_LOGIN_START' + loginPreview.toString('base64') + 'QA_LOGIN_END');
  await page.getByLabel('비밀번호', { exact: true }).fill('sample-password');
  assert.equal(await page.getByLabel('비밀번호', { exact: true }).evaluate((input) => input.type), 'password');
  await page.getByRole('button', { name: '비밀번호 표시', exact: true }).click();
  assert.equal(await page.getByLabel('비밀번호', { exact: true }).evaluate((input) => input.type), 'text');
  await page.getByRole('button', { name: '비밀번호 숨기기', exact: true }).click();
  assert.equal(await page.getByLabel('비밀번호', { exact: true }).inputValue(), 'sample-password');
  await page.getByRole('button', { name: '아이디 · 비밀번호 찾기', exact: true }).click();
  await page.getByRole('button', { name: '확인', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.getByTestId('login-error').waitFor();
  assert.equal(await page.getByTestId('task-selection-screen').count(), 0);
  await login();
  await checkTasks();
  await page.reload();
  await page.getByTestId('login-screen').waitFor();
  assert.equal(await page.getByLabel('이메일', { exact: true }).inputValue(), '');
  assert.equal(await page.getByLabel('비밀번호', { exact: true }).inputValue(), '');
  await login();
  await checkTasks();
  const preview = await page.screenshot({ path: 'qa-output/task-selection-phone.png', fullPage: true });
  if (process.env.QA_PREVIEW_LOG === '1') console.log('QA_IMAGE_START' + preview.toString('base64') + 'QA_IMAGE_END');
  await checkRegistration('phone', true);
  for (const label of ['영양성분 등록', '재고 현황', '배분 추천', '영양 계산']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('heading', { name: label === '영양성분 등록' ? '물품 선택' : label, exact: true }).waitFor();
    await page.getByRole('button', { name: '뒤로', exact: true }).click();
    await page.getByTestId('task-selection-screen').waitFor();
  }
  await page.getByRole('button', { name: '프로필', exact: true }).click();
  await page.getByRole('button', { name: '설정', exact: true }).click();
  await page.getByRole('heading', { name: '설정', exact: true }).waitFor();
  await page.getByRole('button', { name: '뒤로', exact: true }).click();
  await page.getByRole('button', { name: '로그아웃', exact: true }).click();
  await page.getByTestId('login-screen').waitFor();
  for (const [name, width, height] of [['small-phone', 320, 568], ['wide-layout', 768, 1024], ['landscape', 844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.getByTestId('login-screen').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `qa-output/login-${name}.png`, fullPage: true });
    await login();
    await checkTasks();
    await checkRegistration(name);
    await page.getByTestId('task-nutrition-calculation').scrollIntoViewIfNeeded();
    await page.getByTestId('task-nutrition-calculation').click();
    await page.getByRole('heading', { name: '영양 계산', exact: true }).waitFor();
    await page.getByRole('button', { name: '뒤로', exact: true }).click();
    await page.screenshot({ path: `qa-output/task-selection-${name}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: password, recovery, task navigation, profile/logout, reload reset, responsive layout.');
} finally {
  if (browser) await browser.close();
  server.kill();
}

