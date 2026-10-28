import { test, expect } from '@playwright/test';

const duplicate = 'دسته‌بندی با این نام قبلاً ثبت شده است.';
const duplicateChild = 'زیرگروه با این نام در این دسته‌بندی قبلاً ثبت شده است.';
const createdAt = '2026-10-18T21:00:00Z';
const dateLabel = '۱۴۰۵/۰۷/۲۷'; // Tehran has already crossed midnight.

async function setup(page) {
  const writes = [], errors = [], alerts = [], prompts = [], redirects = [];
  const categories = [
    { id: 11, title: 'دسته فرهنگی', description: 'توضیحات قبلی', createdAt, status: 'active', numSubcategories: 1,
      subcategories: [{ id: 12, parentId: 11, title: 'زیرگروه فرهنگی', createdAt, status: 'active' }] },
    { id: 13, title: 'دسته قدیمی', description: '', createdAt: null, status: 'inactive', numSubcategories: 0, subcategories: [] },
    { id: 14, title: 'دسته سازگار', description: '', created_at: createdAt, status: 'active', numSubcategories: 0, subcategories: [] }
  ];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept(prompts.shift() || 'زیرگروه فرهنگی');
    else { alerts.push(dialog.message()); await dialog.accept(); }
  });
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: { admin: { name: 'مدیر آزمایشی' }, roles: ['super_dashboard_admin'], permissions: ['*'] }, version: 0 }));
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    let json = { data: [], total: 0 }, status = 200;
    if (path.endsWith('/admin/auth/me')) json = { user: { name: 'مدیر آزمایشی', roles: ['super_dashboard_admin'], permissions: ['*'] } };
    else if (path.endsWith('/floors')) json = [{ floor: 0, label: 'همکف' }];
    else if (path.endsWith('/groups/metadata')) json = { groups: [] };
    else if (path.endsWith('/groups/subgroups')) json = { subGroups: {} };
    else if (path.endsWith('/categories') && method === 'GET') json = { items: categories, total: 11, page: 1, pageSize: 7 };
    else if (/\/categories\/11\/subcategories$/.test(path) && method === 'GET') json = { items: categories[0].subcategories };
    else if (method === 'POST' && path.endsWith('/categories')) {
      const body = request.postDataJSON(); writes.push({ method, path, body, headers: request.headers() });
      if (body.title === 'دسته صفحه بعد' || body.subcategories?.length > 1) {
        status = 422;
        const message = body.subcategories?.length > 1 ? duplicateChild : duplicate;
        json = { message: 'The given data was invalid.', errors: { [body.subcategories?.length > 1 ? 'subcategories.1.title' : 'title']: [message] } };
      } else {
        json = { id: 15, ...body, createdAt, numSubcategories: 0, subcategories: [] };
        categories.unshift(json); status = 201;
      }
    } else if (method === 'PUT' && path.endsWith('/categories/11')) {
      const body = request.postDataJSON(); writes.push({ method, path, body, headers: request.headers() });
      if (body.title === 'دسته قدیمی') {
        status = 422; json = { message: duplicate, errors: { title: [duplicate] } };
      } else {
        Object.assign(categories.find(category => category.id === 11), body);
        json = categories.find(category => category.id === 11);
      }
    } else if ((method === 'POST' && path.endsWith('/categories/11/subcategories')) || (method === 'PUT' && path.endsWith('/subcategories/12'))) {
      writes.push({ method, path, body: request.postDataJSON(), headers: request.headers() });
      status = 422; json = { message: 'The given data was invalid.', errors: { title: [duplicateChild] } };
    }
    // Model Laravel's original content negotiation instead of always returning
    // JSON: a fetch accepting */* redirects to the frontend on validation errors.
    if (status === 422 && !request.headers().accept?.includes('application/json')) {
      redirects.push(path);
      await route.fulfill({ status: 302, headers: { location: new URL('/category-validation-redirect', page.url()).href }, body: '' });
      return;
    }
    await route.fulfill({ status, json });
  });
  await page.route('**/category-validation-redirect', route => route.fulfill({ contentType: 'text/html', body: '<html>Validation redirect</html>' }));
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/admin');
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await page.getByText('مدیریت دسته بندی‌ها', { exact: true }).click();
  await expect(page.locator('.categories-table')).toBeVisible();
  return { writes, errors, alerts, prompts, redirects };
}

const categoryRow = (page, title = 'دسته فرهنگی') => page.locator('.categories-table tbody > tr').filter({ has: page.getByText(title, { exact: true }) });

test('category dates use the Persian calendar and Tehran timezone, with a dash for unknown history', async ({ page }) => {
  const { errors } = await setup(page);
  await expect(categoryRow(page).locator('td').nth(3)).toHaveText(dateLabel);
  await expect(categoryRow(page, 'دسته قدیمی').locator('td').nth(3)).toHaveText('-');
  await expect(categoryRow(page, 'دسته سازگار').locator('td').nth(3)).toHaveText(dateLabel);
  await expect(page.locator('.categories-table th')).toHaveCount(7);
  await categoryRow(page).locator('.category-expand-btn').click();
  await expect(categoryRow(page, 'زیرگروه فرهنگی').locator('td').nth(3)).toHaveText(dateLabel);
  expect(errors).toEqual([]);
});

test('the subcategory management modal displays its stored creation date', async ({ page }) => {
  const { errors } = await setup(page);
  await categoryRow(page).getByRole('button', { name: 'ویرایش', exact: true }).click();
  await page.locator('.edit-category-modal .view-all-subgroups-btn').click();
  await expect(page.locator('.subcategories-list-modal tbody tr td').nth(1)).toHaveText(dateLabel);
  expect(errors).toEqual([]);
});

test('a duplicate category on another page shows the server title error and keeps the form for a corrected retry', async ({ page }) => {
  const { writes, alerts, errors, redirects } = await setup(page);
  await page.getByRole('button', { name: 'ایجاد دسته بندی جدید', exact: true }).click();
  const modal = page.locator('.create-category-modal');
  const title = modal.getByPlaceholder('عنوان دسته بندی را بنویسید (فارسی)');
  await title.fill('دسته صفحه بعد'); await modal.locator('textarea').fill('توضیحات محفوظ');
  await modal.getByRole('button', { name: 'تایید و ایجاد', exact: true }).click();
  await expect.poll(() => alerts).toContain(duplicate);
  expect(writes[0].headers.accept).toBe('application/json');
  expect(writes[0].headers.authorization).toBe('Bearer browser-fixture-only');
  expect(redirects).toEqual([]);
  await expect(title).toHaveValue('دسته صفحه بعد');
  await expect(modal.locator('textarea')).toHaveValue('توضیحات محفوظ');
  await title.fill('دسته تازه');
  await modal.getByRole('button', { name: 'تایید و ایجاد', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(categoryRow(page, 'دسته تازه').locator('td').nth(3)).toHaveText(dateLabel);
  expect(writes).toHaveLength(2); expect(errors).toEqual([]);
});

test('duplicate rename stays open while saving the category under its own name preserves its creation date', async ({ page }) => {
  const { writes, alerts, errors, redirects } = await setup(page);
  await categoryRow(page).getByRole('button', { name: 'ویرایش', exact: true }).click();
  const modal = page.locator('.edit-category-modal');
  const title = modal.getByPlaceholder('عنوان دسته بندی (فارسی)');
  await title.fill('دسته قدیمی');
  await modal.getByRole('button', { name: 'تایید و ویرایش', exact: true }).click();
  await expect.poll(() => alerts).toContain(duplicate);
  await expect(title).toHaveValue('دسته قدیمی');
  await title.fill('دسته فرهنگی'); await modal.locator('textarea').fill('توضیحات ویرایش شده');
  await modal.getByRole('button', { name: 'تایید و ویرایش', exact: true }).click();
  await expect(modal).toHaveCount(0);
  await expect(categoryRow(page).locator('td').nth(3)).toHaveText(dateLabel);
  await expect(categoryRow(page)).toContainText('توضیحات ویرایش شده');
  expect(writes).toHaveLength(2); expect(errors).toEqual([]);
  expect(writes.every(write => write.headers.accept === 'application/json')).toBe(true);
  expect(redirects).toEqual([]);
});

test('duplicate subcategories in a new category show their specific validation error without clearing the batch', async ({ page }) => {
  const { alerts, errors } = await setup(page);
  await page.getByRole('button', { name: 'ایجاد دسته بندی جدید', exact: true }).click();
  const modal = page.locator('.create-category-modal');
  await modal.getByPlaceholder('عنوان دسته بندی را بنویسید (فارسی)').fill('دسته تازه');
  for (const title of ['زیرگروه', 'زیرگروه']) {
    await modal.getByPlaceholder('برای دسته بندی زیر گروه ایجاد کنید').fill(title);
    await modal.locator('.add-subcategory-btn2').click();
  }
  await modal.getByRole('button', { name: 'تایید و ایجاد', exact: true }).click();
  await expect.poll(() => alerts).toContain(duplicateChild);
  await expect(modal.locator('.subcategory-item')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('adding or renaming a subcategory displays the server duplicate error in the existing dialog flow', async ({ page }) => {
  const { writes, alerts, prompts, errors, redirects } = await setup(page);
  await categoryRow(page).getByRole('button', { name: 'ویرایش', exact: true }).click();
  prompts.push('زیرگروه فرهنگی');
  await page.locator('.edit-category-modal .add-subgroup-btn-small').click();
  await expect.poll(() => alerts.length).toBe(1);
  expect(alerts[0]).toBe(duplicateChild);
  await page.locator('.edit-category-modal .view-all-subgroups-btn').click();
  prompts.push('زیرگروه فرهنگی');
  await page.locator('.subcategories-list-modal').getByRole('button', { name: 'ویرایش', exact: true }).click();
  await expect.poll(() => alerts.length).toBe(2);
  expect(alerts[1]).toBe(duplicateChild);
  expect(writes).toHaveLength(2); expect(errors).toEqual([]);
  expect(writes.every(write => write.headers.accept === 'application/json')).toBe(true);
  expect(redirects).toEqual([]);
});
