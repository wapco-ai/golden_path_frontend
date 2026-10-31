import { test, expect } from '@playwright/test';
import { ADMIN_ROLE_CODES } from '../../src/auth/admin/adminAccess.js';

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

test('dashboard role alone does not grant map or facility management', async ({ page }) => {
  await openPanel(page, [], ['super_dashboard_admin']);
  await expect(page.locator('#dashboard-menu-item-m')).toBeVisible();
  await expect(page.getByText('مدیریت نقشه', { exact: true })).toBeHidden();
  await expect(page.getByText('مدیریت امکانات', { exact: true })).toBeHidden();
});

test('the screenshot selection hides revoked sections without losing selected registered-users access', async ({ page }) => {
  const roleTitles = Object.keys(ADMIN_ROLE_CODES).filter(title => !['مدیریت کاربران', 'مدیریت نقشه', 'مدیریت دسته بندی'].includes(title));
  await openPanel(page, roleTitles, roleTitles.map(title => ADMIN_ROLE_CODES[title]));
  await expect(page.getByText('مدیریت نقشه', { exact: true })).toBeHidden();
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await expect(page.getByText('مدیریت دسته بندی‌ها', { exact: true })).toBeHidden();
  await expect(page.getByText('مدیریت نقاط راهنما', { exact: true })).toBeHidden();
  await expect(page.getByText('مدیریت ادمین‌ها', { exact: true })).toBeVisible();
  await page.getByText('گزارشات', { exact: true }).click();
  await expect(page.getByText('کاربران ثبت نام کرده', { exact: true })).toBeVisible();
});

test('saving own role revocations refreshes the menu without logging out or reloading', async ({ page }) => {
  let roleTitles = Object.keys(ADMIN_ROLE_CODES);
  let profileRequests = 0;
  const writes = [];
  // Install the dynamic routes after the generic fixtures so they take precedence.
  await openPanel(page, roleTitles, roleTitles.map(title => ADMIN_ROLE_CODES[title]));
  await page.route('**/api/v1/admin/auth/me', route => {
    profileRequests += 1;
    return route.fulfill({ json: { id: 2, name: 'مدیر', roleTitles, roles: roleTitles.map(title => ADMIN_ROLE_CODES[title]), permissions: [] } });
  });
  await page.route('**/api/v1/admin/admins**', async route => {
    const admin = { id: 2, firstName: 'مدیر', lastName: 'آزمایشی', username: 'fixture', email: 'fixture@example.test', roles: roleTitles };
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON(); writes.push(body); roleTitles = body.roles;
      await route.fulfill({ json: { ...admin, roles: roleTitles } });
    } else await route.fulfill({ json: { items: [admin], meta: { totalItems: 1 } } });
  });
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await page.getByText('مدیریت ادمین‌ها', { exact: true }).click();
  await page.locator('#edit-btn21-2').click();
  const modal = page.locator('#edit-admin-modal');
  for (const title of ['مدیریت کاربران', 'مدیریت نقشه', 'مدیریت دسته بندی']) {
    await modal.getByRole('checkbox', { name: title, exact: true }).uncheck();
  }
  await page.locator('#save-admin-btn').click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByText('مدیریت نقشه', { exact: true })).toBeHidden();
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await expect(page.getByText('مدیریت دسته بندی‌ها', { exact: true })).toBeHidden();
  await expect(page.getByText('مدیریت نقاط راهنما', { exact: true })).toBeHidden();
  expect(profileRequests).toBeGreaterThan(0);
  expect(writes).toHaveLength(1);
  expect(writes[0].roles).toContain('ادمین کل داشبورد');
});

test('an open editor is discarded when fresh permissions revoke its section', async ({ page }) => {
  await openPanel(page, ['مدیریت ادمین ها'], ['manage_admins']);
  await page.getByRole('button', { name: 'افزودن ادمین', exact: true }).click();
  await expect(page.locator('#add-admin-modal-unique')).toBeVisible();
  await page.route('**/api/v1/admin/auth/me', route => route.fulfill({ json: { id: 2, name: 'مدیر', roles: ['super_dashboard_admin'], roleTitles: ['ادمین کل داشبورد'] } }));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#add-admin-modal-unique')).toHaveCount(0);
  await expect(page.getByText('مدیریت امکانات', { exact: true })).toBeHidden();
  await expect(page.locator('#dashboard-menu-item-m')).toBeVisible();
});

test('a late profile response cannot restore privileges revoked by a newer profile', async ({ page }) => {
  await openPanel(page, ['مدیریت نقشه', 'ادمین کل داشبورد'], ['manage_map', 'super_dashboard_admin']);
  let releaseOld;
  let calls = 0;
  const gate = new Promise(resolve => { releaseOld = resolve; });
  await page.route('**/api/v1/admin/auth/me', async route => {
    const old = ++calls === 1;
    if (old) await gate;
    await route.fulfill({ json: { id: 2, name: 'مدیر', roles: old ? ['manage_map', 'super_dashboard_admin'] : ['super_dashboard_admin'], roleTitles: [] } });
  });
  await page.evaluate(async () => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    window.oldProfileRequest = useAdminAuthStore.getState().fetchProfile();
  });
  await expect.poll(() => calls).toBe(1);
  await page.evaluate(async () => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    await useAdminAuthStore.getState().fetchProfile();
  });
  await expect(page.getByText('مدیریت نقشه', { exact: true })).toBeHidden();
  releaseOld();
  await page.evaluate(() => window.oldProfileRequest);
  await expect(page.getByText('مدیریت نقشه', { exact: true })).toBeHidden();
});

test('a previous account profile failure cannot log out its replacement', async ({ page }) => {
  await openPanel(page, [], ['super_dashboard_admin']);
  let releaseOld;
  let requested = false;
  const gate = new Promise(resolve => { releaseOld = resolve; });
  await page.route('**/api/v1/admin/auth/me', async route => {
    requested = true;
    await gate;
    await route.fulfill({ status: 423, json: { message: 'Account locked' } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(async () => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    useAdminAuthStore.getState().setAuth({ accessToken: 'replacement-token', user: { id: 3, name: 'مدیر جدید', roles: ['super_dashboard_admin'] } });
  });
  const finished = page.waitForResponse(response => response.url().endsWith('/admin/auth/me'));
  releaseOld(); await finished;
  await expect(page.locator('#amain-sidebar')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('gp_admin_access_token'))).toBe('replacement-token');
});

test('a late refresh response cannot restore a logged-out session', async ({ page }) => {
  await openPanel(page, [], ['super_dashboard_admin']);
  let releaseRefresh;
  let requested = false;
  const gate = new Promise(resolve => { releaseRefresh = resolve; });
  await page.route('**/api/v1/admin/auth/refresh', async route => {
    requested = true;
    await gate;
    await route.fulfill({ json: { accessToken: 'rotated-old-token', refreshToken: 'rotated-old-refresh', user: { id: 2, roles: ['super_dashboard_admin'] } } });
  });
  await page.evaluate(async () => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    const store = useAdminAuthStore.getState();
    store.setAuth({ accessToken: 'old-token', refreshToken: 'old-refresh', user: { id: 2, roles: ['super_dashboard_admin'] } });
    window.oldRefreshRequest = store.refreshSession();
  });
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(async () => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    useAdminAuthStore.getState().clearAuth();
  });
  releaseRefresh();
  await page.evaluate(() => window.oldRefreshRequest);
  await expect(page).toHaveURL(/admin\/login/);
  expect(await page.evaluate(() => sessionStorage.getItem('gp_admin_access_token'))).toBeNull();
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
