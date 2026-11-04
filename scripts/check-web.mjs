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
  await page.goto(baseUrl);
  await page.getByTestId('login-screen').waitFor();
  await page.screenshot({ path: 'qa-output/login-phone.png', fullPage: true });
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
    await page.getByTestId('blank-screen').waitFor();
    assert.equal(await page.getByTestId('blank-screen').innerText(), '');
    assert.equal(await page.getByTestId('login-screen').count(), 0);
    await page.reload();
    await page.getByTestId('login-screen').waitFor();
    assert.equal(await page.getByLabel('아이디', { exact: true }).inputValue(), '');
    assert.equal(await page.getByLabel('비밀번호', { exact: true }).inputValue(), '');
  }
  for (const [name, width, height] of [['small-phone', 320, 568], ['tablet', 768, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.reload();
    await page.getByTestId('login-screen').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `qa-output/login-${name}.png`, fullPage: true });
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await page.getByTestId('blank-screen').waitFor();
  }
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: password, recovery, blank entry, reload reset, phone/tablet layout.');
} finally {
  if (browser) await browser.close();
  server.kill();
}
