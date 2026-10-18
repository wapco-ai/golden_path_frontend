import { test, expect } from '@playwright/test';

async function setup(page, { count = 21, deleteStatus = 200, deleteGate, readGate, readStatus = 200, newFirst = false } = {}) {
  const requests = [], writes = [], errors = [];
  const state = { deleteStatus, failNextList: false };
  const records = Array.from({ length: count }, (_, index) => ({
    id: index + 1, subject: `بازخورد پایش ${index + 1}`, message: `متن پیام آزمایشی شماره ${index + 1}`,
    user: index % 2 ? null : { id: index + 10, name: `فرستنده ${index + 1}`, phone: '09120000000' },
    status: newFirst && index === 0 ? 'new' : 'seen', createdAt: '2026-10-18T10:00:00Z'
  }));
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: { admin: { name: 'مدیر آزمایشی' }, roles: ['admin'], permissions: ['*'] }, version: 0 }));
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    let json = { data: [], total: 0 }, status = 200;
    if (path.endsWith('/admin/auth/me')) json = { user: { name: 'مدیر آزمایشی', roles: ['admin'], permissions: ['*'] } };
    else if (path.endsWith('/floors')) json = [{ floor: 0, label: 'همکف' }];
    else if (path.endsWith('/groups/metadata')) json = { groups: [] };
    else if (path.endsWith('/groups/subgroups')) json = { subGroups: {} };
    else if (path.endsWith('/admin/support-feedbacks') && request.method() === 'GET') {
      const params = Object.fromEntries(url.searchParams); requests.push(params);
      if (state.failNextList) { state.failNextList = false; status = 500; json = { message: 'دریافت لیست ناموفق بود.' }; }
      else {
        const selected = records.filter(record => (!params.status || record.status === params.status) && (!params.q || record.subject.includes(params.q) || record.message.includes(params.q)));
        const pageNumber = Math.max(1, Number(params.page) || 1), limit = Number(params.limit) || 20;
        json = { data: selected.slice((pageNumber - 1) * limit, pageNumber * limit), pagination: { currentPage: pageNumber, perPage: limit, lastPage: Math.max(1, Math.ceil(selected.length / limit)), total: selected.length } };
      }
    } else if (/\/admin\/support-feedbacks\/\d+$/.test(path)) {
      const id = Number(path.split('/').at(-1)), method = request.method();
      writes.push({ id, method, headers: request.headers(), body: method === 'PATCH' ? request.postDataJSON() : null });
      if (method === 'DELETE') {
        if (deleteGate) await deleteGate;
        status = state.deleteStatus;
        if (status === 200 || status === 404) {
          const index = records.findIndex(record => record.id === id);
          if (index !== -1) records.splice(index, 1);
        }
        json = status === 200 ? { success: true, id, message: 'بازخورد حذف شد.' } : { success: false, message: status === 404 ? 'بازخورد یافت نشد.' : 'خطای سرور' };
      } else if (method === 'PATCH') {
        if (readGate) await readGate;
        status = readStatus;
        const record = records.find(record => record.id === id);
        if (status === 200 && record) record.status = 'seen';
        json = status === 200 ? { id, status: 'seen' } : { message: 'بازخورد یافت نشد.' };
      }
    }
    await route.fulfill({ status, json });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/admin');
  await page.getByText('گزارشات', { exact: true }).click();
  await page.getByText('بازخورد ها', { exact: true }).click();
  await expect(page.locator('#feedbacks-table tbody tr')).toHaveCount(Math.min(count, 20));
  return { requests, writes, errors, state, records };
}

const row = (page, id = 1) => page.locator('#feedbacks-table tbody tr').filter({ has: page.getByText(`بازخورد پایش ${id}`, { exact: true }) });
const details = page => page.locator('#feedback-details-modal');
const deleteButton = page => page.locator('#delete-feedback-btn');
const deletes = writes => writes.filter(write => write.method === 'DELETE');

async function openDetails(page, id = 1) {
  await row(page, id).getByRole('button', { name: 'جزئیات بیشتر', exact: true }).click();
  await expect(details(page)).toBeVisible();
}

async function confirmDelete(page) {
  page.once('dialog', dialog => dialog.accept());
  await deleteButton(page).click();
}

test('feedback layout keeps four columns and places delete inside the existing details footer', async ({ page }, testInfo) => {
  const { errors } = await setup(page, { count: 3 });
  await expect(page.locator('#feedbacks-table th')).toHaveCount(4);
  await expect(page.locator('#feedbacks-table')).not.toContainText('حذف بازخورد');
  await page.locator('.feedbacks-page').screenshot({ path: testInfo.outputPath('feedback-list.png') });
  await openDetails(page);
  await expect(deleteButton(page)).toHaveText('حذف بازخورد');
  await expect(page.locator('#close-feedback-modal-btn')).toHaveText('بستن');
  await details(page).screenshot({ path: testInfo.outputPath('feedback-details.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const button of [deleteButton(page), page.locator('#close-feedback-modal-btn')]) {
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  await details(page).screenshot({ path: testInfo.outputPath('feedback-details-mobile.png') });
  expect(errors).toEqual([]);
});

test('cancel leaves feedback intact and confirming removes only that feedback', async ({ page }) => {
  const { writes, errors } = await setup(page, { count: 3 });
  await openDetails(page);
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('حذف'); await dialog.dismiss(); });
  await deleteButton(page).click();
  expect(deletes(writes)).toHaveLength(0);
  await expect(details(page)).toBeVisible();
  await confirmDelete(page);
  await expect(details(page)).toHaveCount(0);
  await expect(row(page)).toHaveCount(0);
  await expect(row(page, 2)).toBeVisible(); await expect(row(page, 3)).toBeVisible();
  expect(deletes(writes)).toHaveLength(1); expect(errors).toEqual([]);
});

test('failed deletion keeps details and the message for a successful retry', async ({ page }) => {
  const { writes, errors, state } = await setup(page, { count: 3, deleteStatus: 500 });
  await openDetails(page); await confirmDelete(page);
  await expect(page.locator('.Toastify__toast--error')).toContainText('خطا در حذف بازخورد');
  await expect(details(page)).toBeVisible(); await expect(deleteButton(page)).toBeEnabled();
  await expect(row(page)).toHaveCount(1);
  state.deleteStatus = 200;
  await confirmDelete(page);
  await expect(details(page)).toHaveCount(0); await expect(row(page)).toHaveCount(0);
  expect(deletes(writes)).toHaveLength(2); expect(errors).toEqual([]);
});

test('pending deletion disables duplicate writes and close controls and sends the admin token', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { writes, errors } = await setup(page, { count: 3, deleteGate: gate });
  try {
    await openDetails(page); await confirmDelete(page);
    await expect.poll(() => deletes(writes).length).toBe(1);
    await expect(deleteButton(page)).toBeDisabled();
    await expect(page.locator('#close-feedback-details-modal')).toBeDisabled();
    await expect(page.locator('#close-feedback-modal-btn')).toBeDisabled();
    expect(deletes(writes)[0].headers.authorization).toBe('Bearer browser-fixture-only');
    expect(deletes(writes)[0].headers.accept).toContain('application/json');
    release();
    await expect(details(page)).toHaveCount(0); await expect(row(page)).toHaveCount(0);
    expect(deletes(writes)).toHaveLength(1); expect(errors).toEqual([]);
  } finally { release(); }
});

test('deleting an emptied last page preserves search and status and loads the last remaining page', async ({ page }) => {
  const { requests, errors } = await setup(page);
  await page.locator('#feedback-search-input').fill('پایش');
  await page.locator('.feedback-status-filter select').selectOption('read');
  await expect.poll(() => requests.at(-1)?.status).toBe('seen');
  await expect(page.locator('#feedbacks-table tbody tr')).toHaveCount(20);
  await page.locator('#feedbacks-pagination').getByRole('button', { name: '2', exact: true }).click();
  await expect(page.locator('#feedbacks-table tbody tr')).toHaveCount(1);
  await openDetails(page, 21); await confirmDelete(page);
  await expect(row(page, 21)).toHaveCount(0);
  await expect(page.locator('#feedbacks-table tbody tr')).toHaveCount(20);
  expect(requests.at(-1)).toMatchObject({ q: 'پایش', status: 'seen', page: '1', limit: '20' });
  await expect(page.locator('#feedback-search-input')).toHaveValue('پایش');
  await expect(page.locator('.feedback-status-filter select')).toHaveValue('read');
  expect(errors).toEqual([]);
});

test('deleting the only feedback produces a stable empty inbox', async ({ page }) => {
  const { requests, errors } = await setup(page, { count: 1 });
  await openDetails(page); await confirmDelete(page);
  await expect(page.getByText('بازخوردی یافت نشد', { exact: true })).toBeVisible();
  await expect(page.locator('#feedbacks-pagination')).toHaveCount(0);
  expect(requests.at(-1).page).toBe('1'); expect(errors).toEqual([]);
});

test('an already deleted feedback is removed from stale details without a deletion error', async ({ page }) => {
  const { writes, errors } = await setup(page, { count: 1, deleteStatus: 404 });
  await openDetails(page); await confirmDelete(page);
  await expect(details(page)).toHaveCount(0);
  await expect(page.getByText('بازخوردی یافت نشد', { exact: true })).toBeVisible();
  await expect(page.locator('.Toastify__toast--info')).toContainText('قبلاً حذف شده');
  await expect(page.locator('.Toastify__toast--error')).toHaveCount(0);
  expect(deletes(writes)).toHaveLength(1); expect(errors).toEqual([]);
});

test('a delayed mark-as-read failure cannot resurrect a deleted message or show an unrelated error', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const { writes, errors } = await setup(page, { count: 2, newFirst: true, readGate: gate, readStatus: 404 });
  try {
    await openDetails(page);
    await expect.poll(() => writes.filter(write => write.method === 'PATCH').length).toBe(1);
    await confirmDelete(page);
    await expect(row(page)).toHaveCount(0); await expect(row(page, 2)).toBeVisible();
    const readResponse = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes('/support-feedbacks/1'));
    release(); await readResponse;
    await page.waitForTimeout(150);
    await expect(row(page)).toHaveCount(0);
    await expect(page.locator('.Toastify__toast--error')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('a failed refresh after successful deletion keeps the deleted row removed and permits refresh retry', async ({ page }) => {
  const { errors, state } = await setup(page, { count: 3 });
  await openDetails(page); state.failNextList = true; await confirmDelete(page);
  await expect(details(page)).toHaveCount(0);
  await expect(page.locator('.Toastify__toast--success')).toContainText('با موفقیت حذف شد');
  await expect(page.locator('.Toastify__toast--error')).toContainText('خطا در دریافت بازخوردها');
  await expect(row(page)).toHaveCount(0);
  await page.locator('.feedbacks-page .refresh-btn').click();
  await expect(row(page, 2)).toBeVisible(); await expect(row(page, 3)).toBeVisible();
  await expect(row(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});
