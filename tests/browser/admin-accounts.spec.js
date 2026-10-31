import { test, expect } from '@playwright/test';

async function setup(page, { legacy = false, rejectUpdate = false } = {}) {
  const writes = [];
  const admins = [{
    id: 41, firstName: 'مدیر', lastName: 'آزمایشی', username: 'fixture-admin',
    email: legacy ? null : 'admin@example.test', roles: legacy ? [] : ['مدیریت نقشه'],
    status: legacy ? 'inactive' : 'active', requiresPasswordReset: legacy, createdAt: '2026-10',
  }];
  await page.addInitScript(() => sessionStorage.setItem('gp_admin_access_token', 'fixture-token'));
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    let json = { data: [], items: [], total: 0 }, status = 200;
    if (path.endsWith('/admin/auth/me')) {
      json = { id: 1, name: 'مدیر کل', roles: ['super_dashboard_admin'], roleTitles: ['ادمین کل داشبورد'], permissions: [] };
    } else if (path.endsWith('/floors')) json = [{ floor: 0, label: 'همکف' }];
    else if (path.endsWith('/admin/admins') && method === 'GET') json = { items: admins, meta: { totalItems: admins.length } };
    else if (path.endsWith('/admin/admins') && method === 'POST') {
      const body = request.postDataJSON(); writes.push({ method, body });
      json = { id: 42, ...body, status: 'active', requiresPasswordReset: false, createdAt: '2026-10' };
      delete json.password;
      admins.unshift(json); status = 201;
    } else if (path.endsWith('/admin/admins/41') && method === 'PATCH') {
      const body = request.postDataJSON(); writes.push({ method, body });
      if (rejectUpdate) {
        status = 422; json = { message: 'The given data was invalid.', errors: { password: ['برای فعال‌سازی این حساب، رمز عبور جدید وارد کنید.'] } };
      } else {
        Object.assign(admins[0], body);
        if (body.password) admins[0].requiresPasswordReset = false;
        delete admins[0].password;
        json = admins[0];
      }
    } else if (path.endsWith('/admin/admins/41')) json = admins[0];
    await route.fulfill({ status, json });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/admin');
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await page.getByText('مدیریت ادمین‌ها', { exact: true }).click();
  await expect(page.locator('#admins-table')).toBeVisible();
  return { writes, admins };
}

test('creation sends the initial password and email and displays the returned email', async ({ page }) => {
  const { writes } = await setup(page);
  await page.getByRole('button', { name: 'افزودن ادمین', exact: true }).click();
  await page.locator('#add-admin-firstname').fill('جدید');
  await page.locator('#add-admin-lastname').fill('آزمایشی');
  await page.locator('#add-admin-username').fill('new-admin');
  await expect(page.locator('#add-admin-submit-btn')).toBeDisabled();
  await page.locator('#add-admin-email').fill('new-admin@example.test');
  await page.locator('#add-admin-password').fill('initial-pass-123');
  await page.locator('#add-role-2').check();
  await page.locator('#add-admin-submit-btn').click();
  await expect(page.locator('#add-admin-modal-unique')).toHaveCount(0);
  await expect(page.locator('#admins-table')).toContainText('new-admin@example.test');
  expect(writes[0].body).toMatchObject({ email: 'new-admin@example.test', password: 'initial-pass-123', roles: ['مدیریت نقشه'] });
});

test('details show email and status; an administrator can suspend and reactivate an account', async ({ page }) => {
  const { writes } = await setup(page);
  await page.locator('#details-btn-41').click();
  await expect(page.locator('#admin-details-modal')).toContainText('admin@example.test');
  await expect(page.locator('#admin-details-modal .status-badge')).toHaveText('فعال');
  await page.locator('#close-details-btn').click();
  for (const status of ['inactive', 'active']) {
    await page.locator('#edit-btn21-41').click();
    await page.locator('#edit-admin-status').selectOption(status);
    await page.locator('#save-admin-btn').click();
    await expect(page.locator('#edit-admin-modal')).toHaveCount(0);
    await page.locator('#details-btn-41').click();
    await expect(page.locator('#admin-details-modal .status-badge')).toHaveText(status === 'active' ? 'فعال' : 'غیرفعال');
    await page.locator('#close-details-btn').click();
  }
  expect(writes.map(write => write.body.status)).toEqual(['inactive', 'active']);
  expect(writes.every(write => !('password' in write.body))).toBe(true);
});

test('legacy deleted accounts require a new password and roles for explicit recovery', async ({ page }) => {
  const { writes } = await setup(page, { legacy: true });
  await page.locator('#edit-btn21-41').click();
  await page.locator('#edit-admin-email').fill('recovered@example.test');
  await page.locator('#role-2').check();
  await page.locator('#edit-admin-status').selectOption('active');
  await page.locator('#save-admin-btn').click();
  await expect(page.getByText('برای فعال‌سازی این حساب، رمز عبور جدید وارد کنید', { exact: true })).toBeVisible();
  expect(writes).toHaveLength(0);
  await page.locator('#edit-admin-password').fill('recovered-pass-123');
  await page.locator('#save-admin-btn').click();
  await expect(page.locator('#edit-admin-modal')).toHaveCount(0);
  expect(writes[0].body).toMatchObject({ status: 'active', password: 'recovered-pass-123', email: 'recovered@example.test', roles: ['مدیریت نقشه'] });
});

test('failed activation keeps the edit form and displays the server field error', async ({ page }) => {
  await setup(page, { legacy: true, rejectUpdate: true });
  await page.locator('#edit-btn21-41').click();
  await page.locator('#edit-admin-email').fill('recovered@example.test');
  await page.locator('#role-2').check();
  await page.locator('#edit-admin-status').selectOption('active');
  await page.locator('#edit-admin-password').fill('recovered-pass-123');
  await page.locator('#save-admin-btn').click();
  await expect(page.locator('#edit-admin-modal')).toBeVisible();
  await expect(page.getByText('برای فعال‌سازی این حساب، رمز عبور جدید وارد کنید.', { exact: true })).toBeVisible();
});

const allRoleTitles = [
  'ادمین کل داشبورد', 'مدیریت کاربران', 'مدیریت نقشه', 'مدیریت دسته بندی',
  'مدیریت اطلاعات فرهنگی', 'مدیریت ادمین ها', 'مدیریت گزارشات', 'مدیریت صفحات',
  'مدیریت بازخورد ها', 'مدیریت دیدگاه ها', 'مدیریت لاگ های مسیریابی',
  'مدیریت کاربران ثبت نام کرده',
];

for (const viewport of [{ width: 1440, height: 900 }, { width: 900, height: 480 }, { width: 360, height: 640 }]) {
  test(`details with every role remain closable at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const { admins } = await setup(page);
    admins[0].roles = allRoleTitles;
    admins[0].email = `${'long-email-'.repeat(8)}@example.test`;
    await page.locator('#details-btn-41').click();
    await page.setViewportSize(viewport);
    const dialog = page.getByRole('dialog', { name: 'جزئیات ادمین', exact: true });
    const headerClose = page.locator('#close-details-modal');
    const footerClose = page.locator('#close-details-btn');
    const body = dialog.locator('.modal-body-admin-details');
    const insideViewport = locator => locator.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.top >= 0 && bounds.left >= 0
        && bounds.bottom <= window.innerHeight && bounds.right <= window.innerWidth;
    });
    await expect.poll(() => insideViewport(dialog)).toBe(true);
    await expect.poll(() => insideViewport(headerClose)).toBe(true);
    await expect.poll(() => insideViewport(footerClose)).toBe(true);
    expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    if (viewport.width > 540) {
      const [first, second] = await Promise.all([dialog.locator('.role-item').nth(0).boundingBox(), dialog.locator('.role-item').nth(1).boundingBox()]);
      expect(Math.abs(first.y - second.y)).toBeLessThan(2);
      expect(Math.abs(first.x - second.x)).toBeGreaterThan(100);
    }
    await page.screenshot({ path: testInfo.outputPath('admin-details.png') });
    await body.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(dialog.locator('.role-item').last()).toBeInViewport();
    expect(await insideViewport(headerClose)).toBe(true);
    expect(await insideViewport(footerClose)).toBe(true);
    await footerClose.click();
    await expect(dialog).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#details-btn-41').click();
    await page.setViewportSize(viewport);
    await headerClose.click();
    await expect(dialog).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#details-btn-41').click();
    await page.setViewportSize(viewport);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}
