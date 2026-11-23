import { test, expect } from '@playwright/test';

async function setupGuidanceMap(page, marks = Array.from({ length: 101 }, (_, index) => ({
    id: index + 1, title: index === 100 ? 'نقطه طبقه منفی یک' : 'نقطه همکف',
    floor: index === 100 ? -1 : 0, latitude: 36.288, longitude: 59.6157, coverage_radius_m: 25, images: [],
  }))) {
  const writes = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
    localStorage.setItem('gp_admin_auth_store', JSON.stringify({
      state: { admin: { name: 'مدیر آزمایشی' }, roles: ['super_dashboard_admin', 'manage_guidance_points'], permissions: ['*'] },
      version: 0
    }));
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    let json = { data: [], total: 0 };
    if (pathname.endsWith('/admin/auth/me')) {
      json = { user: { name: 'مدیر آزمایشی', roles: ['super_dashboard_admin', 'manage_guidance_points'], permissions: ['*'] } };
    } else if (pathname.endsWith('/floors')) {
      json = [{ floor: 0, label: 'همکف' }, { floor: -1, label: 'منفی ۱' }];
    } else if (pathname.endsWith('/groups/metadata')) {
      json = { groups: [] };
    } else if (pathname.endsWith('/groups/subgroups')) {
      json = { subGroups: {} };
    } else if (pathname.endsWith('/admin/guidance-points')) {
      if (request.method() === 'POST') {
        const fields = Object.fromEntries([...request.postData().matchAll(/name="([^"]+)"\r\n\r\n([^\r\n]*)/g)]
          .map(([, key, value]) => [key, value]));
        writes.push(fields);
        marks.push({ id: 102, title: fields.title, floor: Number(fields.floor), latitude: fields.y,
          longitude: fields.x, coverage_radius_m: fields.coverage_radius_m, images: [] });
        json = { success: true };
      } else {
        const limit = Number(searchParams.get('limit'));
        const start = (Number(searchParams.get('page')) - 1) * limit;
        json = { success: true, data: marks.slice(start, start + limit),
          meta: { total: marks.length, last_page: Math.ceil(marks.length / limit) } };
      }
    }
    await route.fulfill({ json });
  });

  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.route('**/fonts/**/*.pbf', route => route.fulfill({ status: 200, contentType: 'application/x-protobuf', body: '' }));
  await page.goto('/#/admin');
  await page.getByText('مدیریت امکانات', { exact: true }).click();
  await page.getByText('مدیریت نقاط راهنما', { exact: true }).click();
  await page.getByRole('button', { name: 'نقشه', exact: true }).click();
  const groundCount = marks.filter(mark => mark.floor === 0).length.toLocaleString('fa-IR');
  await expect(page.locator('.guidance-overview__status')).toHaveText(`${groundCount} نقطه`);
  return { writes, errors };
}

test('guidance map loads every page and opens the add form on the chosen floor', async ({ page }) => {
  test.setTimeout(120000);
  const { writes, errors } = await setupGuidanceMap(page);

  await page.getByLabel('طبقهٔ نقشه').selectOption('-1');
  await expect(page.locator('.guidance-overview__status')).toHaveText('۱ نقطه');
  await page.getByText('نمایش شعاع پوشش', { exact: true }).click();
  const canvas = page.getByRole('region', { name: 'نقشه نقاط راهنما' }).locator('canvas');
  await expect(canvas).toBeVisible();
  const { width, height } = await canvas.boundingBox();
  await expect(async () => {
    await canvas.click({ timeout: 5000, position: { x: width / 2, y: height / 2 } });
    await expect(page.locator('.guidance-overview__item')).toContainText('نقطه طبقه منفی یک', { timeout: 1500 });
  }).toPass({ timeout: 12000 });
  await page.getByRole('button', { name: 'ویرایش', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'ویرایش نقطه راهنما' });
  await expect(dialog.getByLabel('عنوان')).toHaveValue('نقطه طبقه منفی یک');
  await dialog.getByRole('button', { name: 'انصراف' }).click();

  await canvas.click({ timeout: 5000, position: { x: width / 2 + 85, y: height / 2 - 65 } });
  await page.getByRole('button', { name: 'افزودن نقطه راهنما در این محل' }).click();
  dialog = page.getByRole('dialog', { name: 'افزودن نقطه راهنما' });
  await expect(dialog.locator('#guidance-floor')).toHaveValue('-1');
  await expect(dialog.locator('.guidance-modal__coordinates')).toBeVisible();
  await dialog.getByLabel('عنوان').fill('نقطه تازه');
  await dialog.locator('.guidance-modal__save').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.guidance-overview__status')).toHaveText('۲ نقطه');
  expect(writes[0]).toMatchObject({ title: 'نقطه تازه', floor: '-1' });
  expect(Number(writes[0].x)).toBeCloseTo(59.6157, 2);
  expect(Number(writes[0].y)).toBeCloseTo(36.288, 2);

  await page.getByRole('button', { name: 'فهرست', exact: true }).click();
  await page.getByRole('button', { name: 'نمایش روی نقشه: نقطه همکف' }).first().click();
  await expect(page.getByLabel('طبقهٔ نقشه')).toHaveValue('0');
  await expect(page.locator('.guidance-overview__item')).toContainText('نقطه همکف');
  expect(errors).toEqual([]);
});


test('route preview looks in the travel direction at the clicked location and opens a gap on the matching floor', async ({ page }) => {
  test.setTimeout(120000);
  const { writes, errors } = await setupGuidanceMap(page);
  let routeRequest;
  const lookups = [];
  const walk = (floor, longitude, latitude, delta = 0.0002) => ({
    kind: 'walk', floor,
    geometry: { type: 'LineString', coordinates: [[longitude, latitude], [longitude + delta, latitude]] }
  });
  const segments = [
    walk(0, 59.6153, 36.288), { kind: 'stairs', fromFloor: 0, toFloor: -1 },
    walk(-1, 59.6159, 36.288, -0.0002)
  ];
  await page.route('**/api/v1/routing/route', async route => {
    routeRequest = route.request().postDataJSON();
    await route.fulfill({ json: {
      ok: true, status: 'OK', multifloor: true, segments, steps: [],
      geo: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: segments
        .filter(segment => segment.kind === 'walk').map(segment => segment.geometry.coordinates) },
      properties: { multifloor: true, segments } }
    } });
  });
  await page.route('**/guide-preview.png', route => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jX1sAAAAASUVORK5CYII=', 'base64')
  }));
  await page.route('**/api/v1/landmark-view-image?*', async route => {
    const query = new URL(route.request().url()).searchParams;
    lookups.push(Object.fromEntries(query));
    const floor = query.get('floor');
    await route.fulfill({ json: floor === '0'
      ? { source: 'guidance_points', status: 'OK', image: { url: new URL('/guide-preview.png', page.url()).href }, content: { title: 'تصویر راهنمای مسیر' } }
      : { source: 'guidance_points', status: 'NO_MATCH', image: null } });
  });

  await page.getByRole('button', { name: 'بررسی پوشش مسیر', exact: true }).click();
  const canvas = page.getByRole('region', { name: 'نقشه نقاط راهنما' }).locator('canvas');
  await canvas.click({ position: { x: 200, y: 180 } });
  await expect(page.locator('.guidance-route-check__status')).toHaveText('مقصد را روی نقشه انتخاب کنید.');
  await page.getByLabel('طبقهٔ نقشه').selectOption('-1');
  await canvas.click({ position: { x: 240, y: 220 } });
  await page.getByRole('button', { name: 'بررسی مسیر پیاده' }).click();
  await expect(page.locator('.guidance-route-check__status')).toHaveText('۱ بخش بدون راهنما', { timeout: 15000 });
  expect(routeRequest.origin.floor).toBe(0);
  expect(routeRequest.destination.floor).toBe(-1);
  expect(new Set(lookups.map(query => query.floor))).toEqual(new Set(['0', '-1']));
  expect(lookups.every(query => query.source === 'guidance_points' && query.fov === '60'
    && query.max_distance === '250' && Math.abs(Number(query.heading) - (query.floor === '0' ? 90 : 270)) < 1)).toBe(true);
  const firstLookups = lookups.slice();
  const { width, height } = await canvas.boundingBox();
  const preview = page.locator('.guidance-route-image-preview');
  await expect(async () => {
    await canvas.click({ timeout: 4000, position: { x: width / 2 + 14, y: height / 2 } });
    await expect(preview.getByRole('img', { name: 'تصویر راهنمای مسیر' })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
  await expect(preview).toContainText('جهت حرکت ۹۰°');
  const clicked = lookups.at(-1);
  expect(clicked.floor).toBe('0');
  expect(Number(clicked['geo[lat]'])).toBeCloseTo(36.288, 7);
  expect(firstLookups.every(query => Math.abs(Number(query['geo[lng]']) - Number(clicked['geo[lng]'])) > 0.000001)).toBe(true);
  const gap = page.getByRole('list', { name: 'بخش‌های بدون راهنما' }).getByRole('listitem');
  await expect(gap).toContainText('منفی ۱');
  await page.getByLabel('طبقهٔ نقشه').selectOption('-1');
  await expect(async () => {
    await canvas.click({ timeout: 4000 });
    await expect(preview.getByRole('button', { name: 'افزودن نقطه راهنما در این محل' })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 12000 });
  await expect(preview).toContainText('جهت حرکت ۲۷۰°');
  await expect(preview.getByRole('img')).toHaveCount(0);
  await preview.getByRole('button', { name: 'افزودن نقطه راهنما در این محل' }).click();
  const dialog = page.getByRole('dialog', { name: 'افزودن نقطه راهنما' });
  await expect(page.getByLabel('طبقهٔ نقشه')).toHaveValue('-1');
  await expect(dialog.locator('#guidance-floor')).toHaveValue('-1');
  await dialog.getByLabel('عنوان').fill('راهنمای بخش بدون پوشش');
  await dialog.locator('.guidance-modal__save').click();
  await expect(dialog.getByRole('list', { name: 'نقاط نزدیک' })).toContainText('نقطه طبقه منفی یک');
  expect(writes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'ادامه ثبت نقطه جدید' }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({ title: 'راهنمای بخش بدون پوشش', floor: '-1' });
  expect(Number(writes[0].x)).toBeCloseTo(59.6158, 5);
  expect(Number(writes[0].y)).toBeCloseTo(36.288, 5);
  await expect(page.locator('.guidance-route-check__status')).toHaveText('۱ بخش بدون راهنما', { timeout: 15000 });
  expect(errors).toEqual([]);
});


test('nearby confirmation lists the same floor and preserves a draft when inspecting a previous point', async ({ page }) => {
  test.setTimeout(120000);
  const point = (id, title, floor, longitude) => ({
    id, title, floor, latitude: 36.288, longitude, coverage_radius_m: 25, images: [],
  });
  const { writes, errors } = await setupGuidanceMap(page, [
    point(1, 'نقطهٔ همکف', 0, 59.6157),
    point(2, 'نقطهٔ قدیمی غرب', -1, 59.615655),
    point(3, 'نقطهٔ قدیمی شرق', -1, 59.615745),
  ]);

  await page.getByLabel('طبقهٔ نقشه').selectOption('-1');
  await expect(page.locator('.guidance-overview__status')).toHaveText('۲ نقطه');
  const canvas = page.getByRole('region', { name: 'نقشه نقاط راهنما' }).locator('canvas');
  const addAtLocation = page.getByRole('button', { name: 'افزودن نقطه راهنما در این محل' });
  await expect(async () => {
    await canvas.click({ timeout: 4000 });
    await expect(addAtLocation).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 12000 });
  await addAtLocation.click();
  const add = page.getByRole('dialog', { name: 'افزودن نقطه راهنما' });
  await add.getByLabel('عنوان').fill('پیش‌نویس نقطه جدید');
  const review = add.getByRole('list', { name: 'نقاط نزدیک' });
  await add.locator('.guidance-modal__save').click();
  await expect(review.getByRole('listitem')).toHaveCount(2);
  await expect(review).toContainText('نقطهٔ قدیمی شرق');
  await expect(review).toContainText('نقطهٔ قدیمی غرب');
  await expect(review.getByRole('listitem').first()).toContainText(/۴(?:٫[۰-۹])? متر/);
  await expect(review).not.toContainText('نقطهٔ همکف');
  expect(writes).toHaveLength(0);

  await review.getByRole('button', { name: 'ویرایش نقطهٔ قدیمی شرق، شناسه 3' }).click();
  const edit = page.getByRole('dialog', { name: 'ویرایش نقطه راهنما' });
  await expect(edit.getByLabel('عنوان')).toHaveValue('نقطهٔ قدیمی شرق');
  await edit.getByRole('button', { name: 'انصراف' }).click();
  await expect(add.getByLabel('عنوان')).toHaveValue('پیش‌نویس نقطه جدید');
  await expect(add.locator('#guidance-floor')).toHaveValue('-1');

  await add.locator('.guidance-modal__save').click();
  await add.getByRole('button', { name: 'بازگشت به فرم' }).click();
  await expect(add.getByLabel('عنوان')).toHaveValue('پیش‌نویس نقطه جدید');
  expect(writes).toHaveLength(0);
  await add.locator('.guidance-modal__save').click();
  await add.getByRole('button', { name: 'ادامه ثبت نقطه جدید' }).click();
  await expect(add).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ floor: '-1', title: 'پیش‌نویس نقطه جدید' });
  expect(errors).toEqual([]);
});

test('identical map points open an editable list from their cluster', async ({ page }) => {
  test.setTimeout(120000);
  const point = { floor: 0, latitude: 36.288, longitude: 59.6157, coverage_radius_m: 25, images: [] };
  const { errors } = await setupGuidanceMap(page, [
    { ...point, id: 1, title: 'راهنمای اول' },
    { ...point, id: 2, title: 'راهنمای دوم' },
  ]);
  const canvas = page.getByRole('region', { name: 'نقشه نقاط راهنما' }).locator('canvas');
  const card = page.locator('.guidance-overview__card');
  await expect(async () => {
    await canvas.click({ timeout: 4000 });
    await expect(card).toContainText('۲ نقطه در این گروه', { timeout: 2000 });
    await expect(card.locator('.guidance-overview__item')).toHaveCount(2, { timeout: 2000 });
  }).toPass({ timeout: 15000 });
  const edit = page.getByRole('dialog', { name: 'ویرایش نقطه راهنما' });
  for (const { id, title } of [{ id: 1, title: 'راهنمای اول' }, { id: 2, title: 'راهنمای دوم' }]) {
    await card.getByRole('button', { name: `ویرایش ${title}، شناسه ${id}` }).click();
    await expect(edit.getByLabel('عنوان')).toHaveValue(title);
    await edit.getByRole('button', { name: 'انصراف' }).click();
  }
  expect(errors).toEqual([]);
});
