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
    await page.getByTestId('nutrition-registration-screen').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const screenshot = await page.screenshot({ path: 'qa-output/nutrition-registration-' + name + '.png', fullPage: true });
    if (preview && process.env.QA_PREVIEW_LOG === '1') console.log('QA_REGISTRATION_START' + screenshot.toString('base64') + 'QA_REGISTRATION_END');
    for (const method of ['camera', 'photo', 'manual']) {
      const button = page.getByTestId('registration-' + method);
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= page.viewportSize().width, 'Registration actions remain inside the screen');
      if (method === 'manual') {
        await button.click();
        await page.getByTestId('registration-notice').waitFor();
        await page.getByTestId('registration-notice-close').click();
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
        await page.getByTestId('remove-nutrition-photo').click();
        assert.equal(await page.getByTestId('picked-nutrition-image').count(), 0);
      }
    }
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
  for (const checked of [true, false]) {
    await page.reload();
    const checkbox = page.getByRole('checkbox', { name: '로그인 상태 유지', exact: true });
    if (!checked) await checkbox.click();
    assert.equal(await checkbox.getAttribute('aria-checked'), String(checked));
    // Empty credentials must be accepted regardless of checkbox state.
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByTestId('task-selection-screen').waitFor();
    await checkTasks();
    assert.equal(await page.getByTestId('login-screen').count(), 0);
    await page.reload();
    await page.getByTestId('login-screen').waitFor();
    assert.equal(await page.getByLabel('아이디', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('비밀번호', { exact: true }).inputValue(), '');
  }
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await checkTasks();
  const preview = await page.screenshot({ path: 'qa-output/task-selection-phone.png', fullPage: true });
  if (process.env.QA_PREVIEW_LOG === '1') console.log('QA_IMAGE_START' + preview.toString('base64') + 'QA_IMAGE_END');
  await checkRegistration('phone', true);
  for (const label of ['영양성분 등록', '재고 현황', '배분 추천', '영양 계산']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('heading', { name: label, exact: true }).waitFor();
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
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByTestId('task-selection-screen').waitFor();
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
