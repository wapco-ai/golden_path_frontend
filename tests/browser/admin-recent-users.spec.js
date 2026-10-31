import { test, expect } from '@playwright/test';

// Run the UI away from Tehran: dates must follow the API contract, not this zone.
test.use({ timezoneId: 'America/Los_Angeles' });

const profile = (id, values = {}) => ({
  id, name: `کاربر نمونه ${id}`, mobile: `0912000000${id}`, phone: `0912000000${id}`,
  email: null, birthDate: null, gender: null, province: null, city: null,
  joinDate: '2026-10-18T12:00:00.000000Z', lastLoginAt: null,
  successCount: 0, savedRoutesCount: null, placeVisitsCount: null, ...values
});
const fixtures = () => [
  profile(1, { name: 'علی فارس', mobile: '+989121234567', phone: '+989121234567',
    email: 'ali@example.test', birthDate: '1990-01-01', gender: 'male', province: 'فارس', city: 'شیراز',
    joinDate: '2025-12-22T21:00:00.000000Z', lastLoginAt: '2026-10-18T01:02:03+03:30', successCount: 25 }),
  profile(2, { name: 'سارا تهران', mobile: '09129876543', phone: '09129876543',
    email: 'sara@example.test', birthDate: '2000-12-31', gender: 'female', province: 'تهران', city: 'تهران',
    lastLoginAt: '2026-10-17T21:15:00Z' }),
  profile(3, { name: 'کاربر بدون اطلاعات', mobile: null, phone: null, joinDate: null }),
  profile(4, { name: 'کاربر داده قدیمی', mobile: null, phone: '09121112222',
    birthDate: '2000-02-30', joinDate: 'not-a-date', lastLoginAt: 'not-a-date', gender: 'other' }),
  profile(5, { name: 'کاربر آمار صفر', savedRoutesCount: 0, placeVisitsCount: 3 }),
  profile(6),
  profile(7, { name: 'کاربر صفحه دوم', birthDate: '1980-01-01', province: 'یزد', city: 'یزد' }),
  profile(8)
];

async function setup(page) {
  const requests = [], writes = [], errors = [];
  const state = { users: fixtures(), failNext: false };
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00Z'));
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'recent-users-fixture-only');
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: { admin: { id: 101, name: 'مدیر آزمایشی' }, roles: ['super_dashboard_admin', 'manage_registered_users'], permissions: ['*'] }, version: 0 }));
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (request.method() !== 'GET') writes.push({ path, method: request.method() });
    let status = 200, json = { data: [], total: 0 };
    if (path.endsWith('/admin/auth/me')) json = { user: { id: 101, name: 'مدیر آزمایشی', roles: ['super_dashboard_admin', 'manage_registered_users'], permissions: ['*'] } };
    else if (path.endsWith('/floors')) json = [{ floor: 0, label: 'همکف' }];
    else if (path.endsWith('/groups/metadata')) json = { groups: [] };
    else if (path.endsWith('/groups/subgroups')) json = { subGroups: {} };
    else if (path.endsWith('/dashboard/notifications')) json = { items: [], unreadCount: 0 };
    else if (path.endsWith('/dashboard/recent-users')) {
      const params = Object.fromEntries(url.searchParams);
      requests.push({ params, authorization: request.headers().authorization });
      if (state.failNext) { state.failNext = false; status = 500; json = { message: 'دریافت اطلاعات ناموفق بود' }; }
      else {
        const selected = state.users.filter(user => !params.search || [user.name, user.email, user.mobile, user.phone].some(value => value?.includes(params.search)));
        const page = Number(params.page) || 1, pageSize = Number(params.pageSize) || 6;
        json = { data: selected.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total: selected.length, pages: Math.max(1, Math.ceil(selected.length / pageSize)) } };
      }
    }
    await route.fulfill({ status, json });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/admin');
  await expect(rows(page)).toHaveCount(6);
  return { state, requests, writes, errors };
}

const section = page => page.locator('.users-section');
const rows = page => section(page).locator('.users-table tbody tr');
const row = (page, name) => rows(page).filter({ has: page.getByText(name, { exact: true }) });
const modal = page => page.locator('.user-details-modal');
const field = (page, label) => modal(page).getByText(label, { exact: true }).locator('..').locator('.detail-value');
const statistic = (page, label) => modal(page).getByText(label, { exact: true }).locator('..').locator('.info-value3');
async function details(page, name) { await row(page, name).getByRole('button', { name: 'جزئیات بیشتر', exact: true }).click(); await expect(modal(page)).toBeVisible(); }
async function close(page) { await modal(page).getByRole('button', { name: 'بستن', exact: true }).click(); await expect(modal(page)).toHaveCount(0); }

test('real row profiles show distinct birth dates without changing the table or modal controls', async ({ page }, testInfo) => {
  const { requests, writes, errors } = await setup(page);
  await expect(section(page).locator('th')).toHaveCount(6);
  await expect(row(page, 'علی فارس')).toContainText('+989121234567');
  await expect(row(page, 'علی فارس')).toContainText('مرد');
  await expect(row(page, 'سارا تهران')).toContainText('زن');
  await section(page).screenshot({ path: testInfo.outputPath('recent-users-table.png') });
  await details(page, 'علی فارس');
  await expect(modal(page).locator('.detail-item')).toHaveCount(8);
  await expect(modal(page).locator('.info-card')).toHaveCount(2);
  await expect(field(page, 'تاریخ تولد:')).toHaveText('۱۳۶۸/۱۰/۱۱');
  await expect(field(page, 'آدرس ایمیل:')).toHaveText('ali@example.test');
  await expect(field(page, 'استان:')).toHaveText('فارس');
  await expect(field(page, 'شهر:')).toHaveText('شیراز');
  await expect(field(page, 'آخرین ورود:')).toContainText('۰۱:۰۲:۰۳');
  await modal(page).screenshot({ path: testInfo.outputPath('recent-user-details-desktop.png') });
  await close(page); await details(page, 'سارا تهران');
  await expect(field(page, 'تاریخ تولد:')).toHaveText('۱۳۷۹/۱۰/۱۱');
  await expect(field(page, 'آدرس ایمیل:')).toHaveText('sara@example.test');
  await expect(field(page, 'استان:')).toHaveText('تهران');
  await expect(field(page, 'شهر:')).toHaveText('تهران');
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await modal(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await modal(page).screenshot({ path: testInfo.outputPath('recent-user-details-mobile.png') });
  expect(requests[0].authorization).toBe('Bearer recent-users-fixture-only');
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});

test('unknown profile values and untracked metrics remain missing while actual zero stays zero', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await expect(row(page, 'کاربر بدون اطلاعات').locator('td').nth(2)).toHaveText('ثبت نشده');
  await details(page, 'کاربر بدون اطلاعات');
  for (const label of ['تاریخ تولد:', 'آدرس ایمیل:', 'استان:', 'شهر:', 'آخرین ورود:']) await expect(field(page, label)).toHaveText('ثبت نشده');
  await expect(field(page, 'شماره تماس:')).toHaveText('-');
  await expect(field(page, 'مسیریابی موفق:')).toHaveText('0 بار');
  for (const label of ['تعداد مسیرهای ذخیره شده:', 'تعداد بازدید از مکان‌ها:']) await expect(statistic(page, label)).toHaveText('ثبت نشده');
  await close(page); await details(page, 'کاربر آمار صفر');
  await expect(statistic(page, 'تعداد مسیرهای ذخیره شده:')).toHaveText('0');
  await expect(statistic(page, 'تعداد بازدید از مکان‌ها:')).toHaveText('3');
  await close(page); await details(page, 'کاربر آمار صفر');
  await expect(statistic(page, 'تعداد مسیرهای ذخیره شده:')).toHaveText('0');
  await expect(statistic(page, 'تعداد بازدید از مکان‌ها:')).toHaveText('3');
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});

test('registration and login instants use Tehran while birth dates keep their recorded calendar day', async ({ page }) => {
  const { state, errors } = await setup(page);
  const registration = row(page, 'علی فارس').locator('td').nth(2);
  await expect(registration).toContainText('۱۴۰۴/۱۰/۰۲'); await expect(registration).toContainText('۰۰:۳۰:۰۰');
  state.users[0].joinDate = '2025-12-22 21:00:00';
  await section(page).locator('.refresh-btn').click();
  await expect(section(page).locator('.refresh-btn')).toBeEnabled();
  await expect(registration).toContainText('۱۴۰۴/۱۰/۰۲'); await expect(registration).toContainText('۰۰:۳۰:۰۰');
  await details(page, 'علی فارس');
  await expect(field(page, 'تاریخ تولد:')).toHaveText('۱۳۶۸/۱۰/۱۱');
  await expect(field(page, 'آخرین ورود:')).toContainText('۰۱:۰۲:۰۳');
  expect(errors).toEqual([]);
});

test('invalid legacy dates are never replaced by today or the old fixed birthday', async ({ page }) => {
  const { errors } = await setup(page);
  await expect(row(page, 'کاربر داده قدیمی').locator('td').nth(2)).toHaveText('ثبت نشده');
  await details(page, 'کاربر داده قدیمی');
  await expect(field(page, 'تاریخ تولد:')).toHaveText('ثبت نشده');
  await expect(field(page, 'آخرین ورود:')).toHaveText('ثبت نشده');
  await expect(field(page, 'شماره تماس:')).toHaveText('09121112222');
  await expect(field(page, 'جنسیت:')).toHaveText('سایر');
  expect(errors).toEqual([]);
});

test('pagination and search keep the correct real profile attached to each row', async ({ page }) => {
  const { requests, errors } = await setup(page);
  await section(page).getByRole('button', { name: '2', exact: true }).click();
  await expect(rows(page)).toHaveCount(2);
  expect(requests.at(-1).params).toMatchObject({ page: '2', pageSize: '6' });
  await details(page, 'کاربر صفحه دوم');
  await expect(field(page, 'تاریخ تولد:')).not.toHaveText('ثبت نشده');
  await expect(field(page, 'استان:')).toHaveText('یزد'); await close(page);
  await section(page).getByPlaceholder('جستجوی نام، نام خانوادگی و..').fill('سارا');
  await expect(rows(page)).toHaveCount(1);
  await expect.poll(() => requests.at(-1).params.search).toBe('سارا');
  expect(requests.at(-1).params.page).toBe('1');
  await details(page, 'سارا تهران'); await expect(field(page, 'تاریخ تولد:')).toHaveText('۱۳۷۹/۱۰/۱۱');
  expect(errors).toEqual([]);
});

test('refresh failures retain confirmed rows and a successful retry reads updated real data', async ({ page }) => {
  const { state, errors } = await setup(page);
  state.users[0].birthDate = '2000-12-31'; state.users[0].email = 'updated@example.test'; state.failNext = true;
  await section(page).locator('.refresh-btn').click();
  await expect(page.locator('.Toastify__toast--error')).toBeVisible();
  await expect(page.locator('.Toastify__toast--success')).toHaveCount(0);
  await page.locator('.Toastify__close-button').click();
  await expect(page.locator('.Toastify__toast--error')).toHaveCount(0);
  await details(page, 'علی فارس'); await expect(field(page, 'تاریخ تولد:')).toHaveText('۱۳۶۸/۱۰/۱۱'); await close(page);
  await section(page).locator('.refresh-btn').click(); await expect(section(page).locator('.refresh-btn')).toBeEnabled();
  await details(page, 'علی فارس'); await expect(field(page, 'تاریخ تولد:')).toHaveText('۱۳۷۹/۱۰/۱۱');
  await expect(field(page, 'آدرس ایمیل:')).toHaveText('updated@example.test'); expect(errors).toEqual([]);
});

test('the existing Excel action exports real counts and unmodified mobile values', async ({ page }) => {
  const { writes, errors } = await setup(page);
  await page.evaluate(() => {
    window.XLSX = {
      utils: {
        aoa_to_sheet(data) { window.exportedUserRows = data; return { '!ref': 'A1:E7' }; },
        decode_range() { return { s: { r: 0, c: 0 }, e: { r: 6, c: 4 } }; },
        encode_cell({ c, r }) { return `${String.fromCharCode(65 + c)}${r + 1}`; },
        book_new() { return {}; }, book_append_sheet() {}
      },
      writeFile(_book, filename) { window.exportedUserFilename = filename; }
    };
  });
  await section(page).getByRole('button', { name: 'مشاهده همه گزارش', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.exportedUserFilename)).toMatch(/\.xlsx$/);
  const data = await page.evaluate(() => window.exportedUserRows);
  expect(data[1]).toEqual(['علی فارس', '+989121234567', expect.stringContaining('۰۰:۳۰:۰۰'), 'مرد', '25 بار']);
  expect(data[2][1]).toBe('09129876543');
  expect(data[3]).toEqual(['کاربر بدون اطلاعات', '-', 'ثبت نشده', '-', '0 بار']);
  expect(writes).toEqual([]); expect(errors).toEqual([]);
});
