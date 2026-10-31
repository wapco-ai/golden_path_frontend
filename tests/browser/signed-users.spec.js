import { test, expect } from '@playwright/test';

const activationDate = '2026-10-18T17:30:00Z';

async function setup(page, { failStatus = false, slowSearch = false } = {}) {
  const requests = [], writes = [], errors = [];
  const users = Array.from({ length: 25 }, (_, index) => ({
    id: index + 1, name: `کاربر شماره ${index + 1}`, username: `user-${index + 1}`,
    mobile: `09120000${String(index + 1).padStart(3, '0')}`, email: `user${index + 1}@example.test`,
    status: index === 0 ? 'disabled' : 'active', isActive: index !== 0,
    createdAt: index < 22 ? '2026-10-18T10:00:00Z' : '2026-10-15T10:00:00Z',
    lastLoginAt: null, lastLoginIp: null, lastManualActivationAt: null
  }));
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00Z'));
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: { admin: { name: 'مدیر آزمایشی' }, roles: ['super_dashboard_admin', 'manage_registered_users'], permissions: ['*'] }, version: 0 }));
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    let json = { data: [], total: 0 }, status = 200;
    if (path.endsWith('/admin/auth/me')) json = { user: { name: 'مدیر آزمایشی', roles: ['super_dashboard_admin', 'manage_registered_users'], permissions: ['*'] } };
    else if (path.endsWith('/floors')) json = [{ floor: 0, label: 'همکف' }];
    else if (path.endsWith('/groups/metadata')) json = { groups: [] };
    else if (path.endsWith('/groups/subgroups')) json = { subGroups: {} };
    else if (path.endsWith('/admin/users') && request.method() === 'GET') {
      const params = Object.fromEntries(url.searchParams); requests.push(params);
      if (slowSearch && params.search === 'شماره 2') await new Promise(resolve => setTimeout(resolve, 650));
      let selected = users.filter(user => !params.search || user.name.includes(params.search) || user.email.includes(params.search));
      if (params.startDate) selected = selected.filter(user => user.createdAt.slice(0, 10) >= params.startDate);
      if (params.endDate) selected = selected.filter(user => user.createdAt.slice(0, 10) <= params.endDate);
      const page = Math.max(1, Number(params.page) || 1), pageSize = Number(params.pageSize) || 20;
      if (pageSize > 100) { status = 422; json = { message: 'اندازه صفحه نامعتبر است.' }; }
      else json = { data: selected.slice((page - 1) * pageSize, page * pageSize), meta: { current_page: page, per_page: pageSize, last_page: Math.max(1, Math.ceil(selected.length / pageSize)), total: selected.length } };
    } else if (/\/admin\/users\/\d+$/.test(path)) {
      json = { data: users.find(user => user.id === Number(path.split('/').at(-1))) };
    } else if (/\/admin\/users\/\d+\/status$/.test(path)) {
      const body = request.postDataJSON(), id = Number(path.split('/').at(-2));
      writes.push({ id, body });
      if (failStatus) { status = 500; json = { message: 'ذخیره وضعیت ناموفق بود.' }; }
      else {
        const user = users.find(user => user.id === id);
        if (body.status === 'active' && user.status !== 'active') user.lastManualActivationAt = activationDate;
        user.status = body.status === 'active' ? 'active' : 'disabled';
        user.isActive = body.status === 'active'; json = { data: user };
      }
    }
    await route.fulfill({ status, json });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/admin');
  await page.getByText('گزارشات', { exact: true }).click();
  await page.getByText('کاربران ثبت نام کرده', { exact: true }).click();
  await expect(page.locator('.usersigned-page .users-table tbody tr')).toHaveCount(20);
  return { requests, writes, errors, users };
}

const userRow = (page, id = 1) => page.locator('.usersigned-page .users-table tbody tr').filter({ has: page.getByText(`کاربر شماره ${id}`, { exact: true }) });
const startInput = page => page.getByRole('textbox', { name: 'تاریخ شروع', exact: true });
const endInput = page => page.getByRole('textbox', { name: 'تاریخ پایان', exact: true });

async function enterRange(page, start = '۱۴۰۵/۰۷/۲۶', end = '1405/07/26') {
  await startInput(page).fill(start); await startInput(page).press('Enter');
  await endInput(page).fill(end); await endInput(page).press('Enter');
}

test('registered-user report keeps its six columns and current controls', async ({ page }, testInfo) => {
  const { errors } = await setup(page);
  await expect(page.locator('.usersigned-page .users-table th')).toHaveCount(6);
  await expect(page.getByPlaceholder('جستجو بر اساس نام، ایمیل یا موبایل')).toBeVisible();
  await expect(page.getByRole('button', { name: 'خروجی گزارشات', exact: true })).toBeVisible();
  await page.locator('.usersigned-page').screenshot({ path: testInfo.outputPath('signed-users-report.png') });
  expect(errors).toEqual([]);
});

test('manual activation uses the server result and exposes its time in the existing details grid', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await userRow(page).getByRole('button', { name: 'جزئیات', exact: true }).click();
  const detail = page.locator('.user-details-modal-overlay');
  await expect(detail.getByText('آخرین فعال‌سازی دستی:', { exact: true }).locator('..')).toContainText('—');
  await detail.getByRole('button', { name: 'بستن', exact: true }).click();
  await userRow(page).getByRole('button', { name: 'فعال', exact: true }).click();
  await expect(userRow(page).getByRole('button', { name: 'غیرفعال', exact: true })).toBeEnabled();
  await userRow(page).getByRole('button', { name: 'جزئیات', exact: true }).click();
  const activation = detail.getByText('آخرین فعال‌سازی دستی:', { exact: true }).locator('..');
  await expect(activation).toContainText('۱۴۰۵'); await expect(activation).toContainText('۲۱:۰۰');
  await detail.getByRole('button', { name: 'بستن', exact: true }).click();
  await userRow(page).getByRole('button', { name: 'غیرفعال', exact: true }).click();
  await expect(userRow(page).getByRole('button', { name: 'فعال', exact: true })).toBeEnabled();
  await userRow(page).getByRole('button', { name: 'جزئیات', exact: true }).click();
  await expect(activation).toContainText('۲۱:۰۰');
  expect(writes.map(write => write.body)).toEqual([{ status: 'active' }, { status: 'inactive' }]);
  expect(errors).toEqual([]);
});

test('a rejected activation retains the previous state and does not invent a timestamp', async ({ page }) => {
  const { writes, errors } = await setup(page, { failStatus: true });
  await userRow(page).getByRole('button', { name: 'فعال', exact: true }).click();
  await expect(page.locator('.Toastify__toast--error')).toBeVisible();
  await expect(userRow(page).getByRole('button', { name: 'فعال', exact: true })).toBeEnabled();
  await userRow(page).getByRole('button', { name: 'جزئیات', exact: true }).click();
  await expect(page.getByText('آخرین فعال‌سازی دستی:', { exact: true }).locator('..')).toContainText('—');
  expect(writes).toHaveLength(1); expect(errors).toEqual([]);
});

test('an old refresh response cannot undo a successful activation', async ({ page }) => {
  const { users, errors } = await setup(page);
  let releaseStatus, releaseList, statusStarted = false, listStarted = false;
  const statusGate = new Promise(resolve => { releaseStatus = resolve; });
  const listGate = new Promise(resolve => { releaseList = resolve; });
  await page.route('**/api/v1/admin/users**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (path.endsWith('/1/status')) {
      statusStarted = true;
      await statusGate;
      return route.fallback();
    }
    if (path.endsWith('/admin/users') && request.method() === 'GET') {
      const snapshot = JSON.parse(JSON.stringify(users.slice(0, 20)));
      listStarted = true;
      await listGate;
      return route.fulfill({ json: { data: snapshot, meta: { current_page: 1, per_page: 20, last_page: 2, total: 25 } } });
    }
    return route.fallback();
  });
  try {
    await userRow(page).getByRole('button', { name: 'فعال', exact: true }).click();
    await expect.poll(() => statusStarted).toBe(true);
    await expect(userRow(page).getByRole('button', { name: 'جزئیات', exact: true })).toBeDisabled();
    await page.locator('.usersigned-page .refresh-btn').click();
    await expect.poll(() => listStarted).toBe(true);
    releaseStatus();
    await expect(page.locator('.Toastify__toast--success')).toBeVisible();
    releaseList();
    await expect(page.locator('.usersigned-page .refresh-btn')).toBeEnabled();
    await expect(userRow(page).getByRole('button', { name: 'غیرفعال', exact: true })).toBeEnabled();
    await userRow(page).getByRole('button', { name: 'جزئیات', exact: true }).click();
    await expect(page.getByText('آخرین فعال‌سازی دستی:', { exact: true }).locator('..')).toContainText('۲۱:۰۰');
    expect(errors).toEqual([]);
  } finally {
    releaseStatus(); releaseList();
  }
});

test('typed Persian and Latin dates filter on the server and survive pagination, search and refresh', async ({ page }) => {
  const { requests, errors } = await setup(page);
  await enterRange(page);
  await expect.poll(() => requests.at(-1)?.endDate).toBe('2026-10-18');
  expect(requests.at(-1).startDate).toBe('2026-10-18');
  expect(requests.every(request => Number(request.pageSize) <= 100)).toBe(true);
  await page.locator('#users-pagination').getByRole('button', { name: '2', exact: true }).click();
  await expect(page.locator('.usersigned-page .users-table tbody tr')).toHaveCount(2);
  expect(requests.at(-1)).toMatchObject({ page: '2', startDate: '2026-10-18', endDate: '2026-10-18' });
  await page.getByPlaceholder('جستجو بر اساس نام، ایمیل یا موبایل').fill('شماره 21');
  await expect.poll(() => requests.at(-1)?.search).toBe('شماره 21');
  await expect(userRow(page, 21)).toBeVisible();
  expect(requests.at(-1)).toMatchObject({ page: '1', startDate: '2026-10-18', endDate: '2026-10-18' });
  const beforeRefresh = requests.length;
  await page.locator('.usersigned-page .refresh-btn').click();
  await expect.poll(() => requests.length).toBeGreaterThan(beforeRefresh);
  expect(requests.at(-1)).toMatchObject({ search: 'شماره 21', startDate: '2026-10-18', endDate: '2026-10-18' });
  await page.getByRole('button', { name: 'حذف فیلتر', exact: true }).click();
  await expect.poll(() => requests.at(-1)?.startDate).toBeUndefined();
  await expect.poll(() => requests.at(-1)?.endDate).toBeUndefined();
  expect(errors).toEqual([]);
});

test('calendar opens at the current date and supports direct year selection and correct weekdays', async ({ page }) => {
  const { errors } = await setup(page);
  await startInput(page).click();
  const calendar = page.locator('.usersigned-page .calendar-popup');
  const year = calendar.getByLabel('سال', { exact: true });
  await expect(year).toHaveValue('1405');
  await year.fill('1400'); await year.press('Enter');
  await expect(year).toHaveValue('1400');
  await year.fill('1405'); await year.press('Enter');
  await calendar.getByLabel('ماه', { exact: true }).selectOption('7');
  await expect(calendar.locator('.calendar-day.empty')).toHaveCount(4);
  await calendar.getByRole('button', { name: '1405/07/01', exact: true }).click();
  await expect(startInput(page)).toHaveValue(/1405\/07\/01|۱۴۰۵\/۰۷\/۰۱/);
  await page.keyboard.press('Escape');
  await expect(calendar).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('invalid Jalali dates and reversed ranges do not issue an invalid filter request', async ({ page }) => {
  const { requests, errors } = await setup(page);
  const count = requests.length;
  await startInput(page).fill('۱۴۰۵/۱۲/۳۰'); await startInput(page).press('Enter');
  await expect(page.locator('.Toastify__toast--error')).toBeVisible();
  expect(requests).toHaveLength(count);
  await enterRange(page, '1405/07/26', '1405/07/25');
  await expect(page.locator('.Toastify__toast--error').last()).toBeVisible();
  expect(requests.some(request => request.startDate && request.endDate && request.startDate > request.endDate)).toBe(false);
  expect(errors).toEqual([]);
});

test('a slower obsolete search cannot overwrite the newest users response', async ({ page }) => {
  const { requests, errors } = await setup(page, { slowSearch: true });
  const search = page.getByPlaceholder('جستجو بر اساس نام، ایمیل یا موبایل');
  await search.fill('شماره 2');
  await expect.poll(() => requests.at(-1)?.search).toBe('شماره 2');
  await search.fill('شماره 1');
  await expect.poll(() => requests.at(-1)?.search).toBe('شماره 1');
  await expect(userRow(page, 1)).toBeVisible();
  await page.waitForTimeout(700);
  await expect(userRow(page, 1)).toBeVisible();
  expect(errors).toEqual([]);
});
