import { test, expect } from '@playwright/test';

async function openAreaTools(page, area, update, floor = 0) {
  const center = [59.6161, 36.2888];
  const [lon, lat] = center;
  const boundary = [
    [lon - 0.0002, lat - 0.0002], [lon + 0.0002, lat - 0.0002],
    [lon + 0.0002, lat + 0.0002], [lon - 0.0002, lat + 0.0002],
    [lon - 0.0002, lat - 0.0002],
  ];
  await page.addInitScript((floor) => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
    sessionStorage.setItem('haramCurrentFloor', String(floor));
  }, floor);
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json = { data: [], total: 0 };
    if (path.endsWith('/admin/auth/me')) {
      json = { id: 1, name: 'مدیر آزمایشی', roles: ['super_dashboard_admin', 'manage_map'], permissions: [] };
    } else if (path.endsWith('/floors')) {
      json = [{ floor: 0, label: 'همکف' }, { floor: -1, label: 'منفی ۱' }];
    } else if (path.endsWith(`/areas/${area.id}`)) {
      if (route.request().method() === 'PUT') {
        return route.fulfill(update(route.request().postDataJSON()));
      } else {
        json = area;
      }
    }
    await route.fulfill({ json });
  });
  await page.route('**/map-styles/**/style*.json', (route) => route.fulfill({
    json: {
      version: 8,
      sources: { fn_areas_mvt: { type: 'geojson', data: {
        type: 'Feature', properties: { id: area.id, floor },
        geometry: { type: 'Polygon', coordinates: [boundary] },
      } } },
      layers: [{ id: 'areas-outline', type: 'fill', source: 'fn_areas_mvt', paint: { 'fill-color': '#afb8c0' } }],
    },
  }));
  await page.route('**/tiles/**', (route) => route.fulfill({ status: 204 }));

  await page.goto('/#/admin');
  await page.getByText('مدیریت نقشه', { exact: true }).click();
  await page.getByText('لایه‌های نقشه', { exact: true }).click();
  await page.locator('.layer-toggle').filter({ has: page.getByText('areas-outline', { exact: true }) })
    .locator('.edit-layer-btn').click();
  await page.getByText('لایه‌های نقشه', { exact: true }).click();
  const map = page.locator('#map-container');
  const bounds = await map.boundingBox();
  await map.click({ position: { x: bounds.width / 2, y: bounds.height / 2 } });
}

test('area routing can be edited separately from public access', async ({ page }) => {
  const area = {
    id: 1001020, title: 'بیت انواریان', default_routing_role: 'doorstep_only',
    attrs_raw: { access_policy: { public_access: true } },
    basic_info: { title: { fa: 'بیت انواریان' } },
    operational: { status: 'active', is_covered: true, transport_modes: ['walk'], gender_access: ['both'] },
  };
  const writes = [];
  await openAreaTools(page, area, (payload) => {
    writes.push(payload);
    area.attrs_raw.routing_role = payload.routing_role;
    return { json: { area_graph: { status: payload.routing_role === 'routable' ? 'ready' : 'entrance_only' } } };
  });

  const editArea = page.getByRole('button', { name: 'ویرایش اطلاعات محدوده انتخاب‌شده' });
  const modal = page.locator('.add-place-modal');
  const steps = modal.locator('.step-circle');
  const save = page.getByRole('button', { name: 'تایید اطلاعات و ثبت این مکان', exact: false });
  const routing = page.getByRole('group', { name: 'عبور از داخل محدوده' });
  await editArea.click();
  await expect(modal).toBeVisible();
  await steps.nth(1).click();

  await expect(page.getByRole('group', { name: 'ماهیت محدوده' }).getByRole('radio', { name: 'عمومی' })).toBeChecked();
  await expect(routing.getByRole('radio', { name: 'پیش‌فرض نوع محدوده' })).toBeChecked();
  await expect(routing.locator('small')).toContainText('فقط تا ورودی');
  await routing.getByRole('radio', { name: 'عبور از داخل مجاز' }).check();
  await steps.nth(2).click();
  await save.click();
  await expect(page.getByText('تنظیم محدوده ثبت شد و گراف داخلی آماده است')).toBeVisible();

  await editArea.click();
  await steps.nth(1).click();
  await expect(routing.getByRole('radio', { name: 'عبور از داخل مجاز' })).toBeChecked();
  await routing.getByRole('radio', { name: 'فقط تا ورودی' }).check();
  await steps.nth(2).click();
  await save.click();
  await expect(modal).toHaveCount(0);

  expect(writes.map((payload) => payload.routing_role)).toEqual(['routable', 'doorstep_only']);
  writes.forEach((payload) => expect(payload).not.toHaveProperty('public_access'));
});

for (const [type, label, graphStatus] of [
  ['elevator_area', 'آسانسور', 'insufficient_access_points'],
  ['stair_area', 'پله', 'ready'],
]) {
  test(`admin converts a basement ${type} to a corridor`, async ({ page }) => {
    const area = {
      id: 1101185, title: 'پیش‌ورودی', meta: { floor: -1, area_type: type },
      attrs_raw: { routing_role: 'transparent', access_policy: { public_access: false } },
    };
    const writes = [];
    await openAreaTools(page, area, (payload) => {
      writes.push(payload);
      if (writes.length === 1) return { status: 422, json: { message: 'اتصال ورودی‌ها را بررسی کنید.' } };
      area.meta.area_type = payload.meta.area_type;
      area.attrs_raw.routing_role = payload.routing_role;
      return { json: { area_graph: { status: graphStatus } } };
    }, -1);
    const open = page.getByRole('button', { name: 'تبدیل به راهرو', exact: true });
    const dialog = page.getByRole('dialog', { name: 'تبدیل محدوده به راهرو' });
    const save = dialog.getByRole('button', { name: 'ثبت به‌عنوان راهرو' });
    await open.click();
    await expect(dialog).toContainText(`نوع فعلی: ${label}`);
    await expect(dialog).toContainText('1101185');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(writes).toHaveLength(0);
    await open.click();
    await save.click();
    await expect(dialog.getByRole('alert')).toContainText('اتصال ورودی‌ها');
    await save.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText(graphStatus === 'ready' ? 'راهرو ثبت شد و گراف داخلی آماده است.' :
      'راهرو ثبت شد. برای ساخت مسیر داخلی دست‌کم دو نقطهٔ اتصال معتبر لازم است.')).toBeVisible();
    expect(writes).toEqual(Array(2).fill({ meta: { area_type: 'functional_area' }, routing_role: 'routable' }));
    await open.click();
    await expect(save).toBeDisabled();
    await expect(dialog).toContainText('عبور از داخل این فضای عملکردی مجاز است.');
  });
}
