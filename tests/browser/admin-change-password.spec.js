import { test, expect } from '@playwright/test';

// Run against a disposable backend fixture only. The URL is mandatory to avoid
// ever sending test credentials to an actual administrator service.
const fixtureUrl = process.env.GP_PASSWORD_FIXTURE_URL;
test.skip(!fixtureUrl, 'Requires GP_PASSWORD_FIXTURE_URL pointing to an isolated fixture.');
test.use({ trace: 'off', screenshot: 'off' });

test('real password endpoint, errors, logout and new login', async ({ page, request }) => {
  const login = await request.post(`${fixtureUrl}/api/v1/admin/auth/login`, { data: { usernameOrEmail: 'test1', password: 'fixture-old-password' } });
  expect(login.ok()).toBeTruthy();
  const tokens = await login.json();
  await page.addInitScript(({ accessToken, refreshToken }) => {
    sessionStorage.setItem('gp_admin_access_token', accessToken);
    localStorage.setItem('gp_admin_refresh_token', refreshToken);
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: { refreshToken }, version: 0 }));
  }, tokens);
  let changeCount = 0;
  let networkFailure = false;
  let serverFailure = false;
  let gate = null;
  await page.route('**/api/v1/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.includes('/admin/auth/')) {
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
      if (path.endsWith('/change-password')) {
        changeCount += 1;
        if (networkFailure) return route.abort('failed');
        if (serverFailure) return route.fulfill({ status: 500, json: { error: 'PASSWORD_CHANGE_FAILED' }, headers: { 'access-control-allow-origin': '*' } });
        if (gate) await gate;
      }
      const result = await route.fetch({ url: `${fixtureUrl}${path}` });
      return route.fulfill({ response: result, headers: { ...result.headers(), 'access-control-allow-origin': '*' } });
    }
    return route.fulfill({ json: path.endsWith('/floors') ? [{ floor: 0, label: 'همکف' }] : { data: [], items: [], total: 0 } });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/admin');
  await page.getByText('تغییر رمز عبور', { exact: true }).first().click();
  const modal = page.locator('.changepass-modal-body');
  const current = modal.getByPlaceholder('رمز عبور فعلی را وارد کنید');
  const next = modal.getByPlaceholder('رمز عبور جدید را وارد کنید');
  const confirm = modal.getByPlaceholder('رمز عبور جدید را مجدداً وارد کنید');
  const submit = modal.getByRole('button', { name: 'تغییر رمز عبور' });
  await current.fill('wrong-password');
  await next.fill('fixture-new-password');
  await confirm.fill('fixture-new-password');
  await submit.click();
  await expect(page.getByText('رمز عبور فعلی اشتباه است.', { exact: true })).toBeVisible();
  await expect(modal).toBeVisible();
  await current.fill('fixture-old-password');
  await confirm.fill('mismatch');
  page.once('dialog', dialog => dialog.accept());
  await submit.click();
  expect(changeCount).toBe(1);
  await confirm.fill('fixture-new-password');
  networkFailure = true;
  await submit.click();
  await expect(page.getByText('ارتباط با سرور برقرار نشد؛ وضعیت تغییر رمز را با ورود بررسی کنید.', { exact: true })).toBeVisible();
  await expect(modal).toBeVisible();
  networkFailure = false;
  serverFailure = true;
  await submit.click();
  await expect(page.getByText('تغییر رمز عبور انجام نشد؛ دوباره تلاش کنید.', { exact: true })).toBeVisible();
  await expect(modal).toBeVisible();
  serverFailure = false;
  let release;
  gate = new Promise(resolve => { release = resolve; });
  await submit.click();
  await expect(modal.getByRole('button', { name: 'در حال تغییر...' })).toBeDisabled();
  await expect.poll(() => changeCount).toBe(4);
  await modal.locator('button.btn-primary').evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(changeCount).toBe(4);
  release();
  await expect(page.getByText('رمز عبور با موفقیت تغییر یافت. لطفاً دوباره وارد شوید.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#\/admin\/login/);
  expect(await page.evaluate(() => [sessionStorage.getItem('gp_admin_access_token'), localStorage.getItem('gp_admin_refresh_token')])).toEqual([null, null]);
  expect((await request.post(`${fixtureUrl}/api/v1/admin/auth/refresh`, { data: { refreshToken: tokens.refreshToken } })).status()).toBe(401);
  expect((await request.post(`${fixtureUrl}/api/v1/admin/auth/login`, { data: { usernameOrEmail: 'test1', password: 'fixture-old-password' } })).status()).toBe(401);
  expect((await request.post(`${fixtureUrl}/api/v1/admin/auth/login`, { data: { usernameOrEmail: 'test1', password: 'fixture-new-password' } })).status()).toBe(200);
});
