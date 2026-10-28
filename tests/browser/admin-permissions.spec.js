import { test, expect } from '@playwright/test';

async function openPanel(page, roleTitles, roles = []) {
  const requests = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'fixture-token');
    // A previous account's permissions must not be trusted on reload.
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: {
      admin: { id: 1, roles: ['super_dashboard_admin'] }, roles: ['super_dashboard_admin']
    }, version: 0 }));
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    let json = { data: [], items: [], total: 0 };
    if (path.endsWith('/admin/auth/me')) json = { id: 2, name: 'مدیر', roleTitles, roles, permissions: [] };
    if (path.endsWith('/floors')) json = [{ floor: 0, label: 'همکف' }];
    if (path.endsWith('/dashboard/notifications')) json = { items: [], unreadCount: 0 };
    await route.fulfill({ json });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/admin');
  await expect(page.locator('#amain-sidebar')).toBeVisible();
  return requests;
}

test('limited role hides other sections and does not request their data', async ({ page }) => {
  const requests = await openPanel(page, ['مدیریت اطلاعات فرهنگی']);
  await expect(page.locator('#dashboard-menu-item-m')).toBeHidden();
  await expect(page.getByText('مدیریت نقشه', { exact: true })).toBeHidden();
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await expect(page.getByText('مدیریت اطلاعات فرهنگی', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('مدیریت ادمین‌ها', { exact: true })).toBeHidden();
  expect(requests.some(path => path.includes('/admin/dashboard/'))).toBe(false);
  expect(requests.some(path => path.endsWith('/admin/admins'))).toBe(false);
});

test('super admin sees all menus after fresh profile validation', async ({ page }) => {
  await openPanel(page, [], ['super_dashboard_admin']);
  await expect(page.locator('#dashboard-menu-item-m')).toBeVisible();
  await expect(page.getByText('مدیریت نقشه', { exact: true })).toBeVisible();
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await expect(page.getByText('مدیریت ادمین‌ها', { exact: true })).toBeVisible();
});

test('a failed profile lookup never displays a persisted super admin profile', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'expired');
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: {
      admin: { id: 1, roles: ['super_dashboard_admin'] }, roles: ['super_dashboard_admin']
    }, version: 0 }));
  });
  await page.route('**/api/v1/admin/auth/me', route => route.fulfill({ status: 503, json: {} }));
  await page.goto('/#/admin');
  await expect(page).toHaveURL(/admin\/login/);
  await expect(page.locator('#amain-sidebar')).toHaveCount(0);
});
