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
  browser = await chromium.launch({ headless: true });
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
      assert.ok(label.x + label.width < box.x + box.width, 'Label stays inside card');
    }
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
