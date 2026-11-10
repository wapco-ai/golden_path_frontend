import { test, expect } from '@playwright/test';

test('area routing can be edited separately from public access', async ({ page }) => {
  const center = [59.6161, 36.2888];
  const [lon, lat] = center;
  const boundary = [
    [lon - 0.0002, lat - 0.0002], [lon + 0.0002, lat - 0.0002],
    [lon + 0.0002, lat + 0.0002], [lon - 0.0002, lat + 0.0002],
    [lon - 0.0002, lat - 0.0002],
  ];
  const area = {
    id: 1001020,
    title: 'بیت انواریان',
    default_routing_role: 'doorstep_only',
    attrs_raw: { access_policy: { public_access: true } },
    basic_info: { title: { fa: 'بیت انواریان' } },
    operational: { status: 'active', is_covered: true, transport_modes: ['walk'], gender_access: ['both'] },
  };
  const writes = [];

  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json = { data: [], total: 0 };
    if (path.endsWith('/admin/auth/me')) {
      json = { id: 1, name: 'مدیر آزمایشی', roles: ['super_dashboard_admin', 'manage_map'], permissions: [] };
    } else if (path.endsWith('/floors')) {
      json = [{ floor: 0, label: 'همکف' }];
    } else if (path.endsWith('/areas/1001020')) {
      if (route.request().method() === 'PUT') {
        const payload = route.request().postDataJSON();
        writes.push(payload);
        area.attrs_raw.routing_role = payload.routing_role;
        json = { area_graph: { status: payload.routing_role === 'routable' ? 'ready' : 'entrance_only' } };
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
        type: 'Feature', properties: { id: area.id, floor: 0 },
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
