import { test, expect } from '@playwright/test';

test.setTimeout(120000);

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


test('basement area type changes work both ways within the same editor', async ({ page }) => {
  const area = {
    id: 1101185, title: 'پیش‌ورودی', meta: { floor: -1, area_type: 'elevator_area' },
    basic_info: { title: { fa: 'پیش‌ورودی' } },
    default_routing_role: 'transparent',
    attrs_raw: { routing_role: 'transparent', access_policy: { public_access: false } },
  };
  const writes = [];
  await openAreaTools(page, area, payload => {
    writes.push(payload);
    if (writes.length === 2) return { status: 422, json: { errors: {
      'meta.area_type': ['توقف آسانسور غربی در طبقه منفی یک وابسته است.'],
    } } };
    const type = payload.meta.area_type;
    area.meta.area_type = type;
    area.default_routing_role = type === 'corridor' ? 'routable' : 'transparent';
    delete area.attrs_raw.routing_role;
    return { json: { area_graph: { status: type === 'corridor' ? 'insufficient_access_points' : 'connector_only' } } };
  }, -1);
  const edit = page.getByRole('button', { name: 'ویرایش اطلاعات محدوده انتخاب‌شده' });
  const modal = page.locator('.add-place-modal');
  const steps = modal.locator('.step-circle');
  const select = modal.getByRole('combobox', { name: 'نوع محدوده', exact: true });
  const save = page.getByRole('button', { name: 'تایید اطلاعات و ثبت این مکان', exact: false });
  async function open() {
    await edit.click();
    await steps.nth(1).click();
  }
  await open();
  await expect(select).toHaveValue('elevator_area');
  await expect(select.locator('option')).toHaveCount(15);
  await select.selectOption('functional_area');
  await expect(modal.getByRole('group', { name: 'عبور از داخل محدوده' })).toContainText('فقط تا ورودی');
  await select.selectOption('corridor');
  await expect(modal).toContainText('عبور از داخل راهرو مجاز است.');
  await expect(modal.getByRole('group', { name: 'عبور از داخل محدوده' })).toHaveCount(0);
  expect(writes).toHaveLength(0);
  await steps.nth(2).click();
  await save.click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByText(/دست‌کم دو نقطهٔ اتصال معتبر لازم است/)).toBeVisible();
  expect(writes[0]).toEqual({ meta: { area_type: 'corridor', expected_area_type: 'elevator_area' } });

  await open();
  await expect(select).toHaveValue('corridor');
  await select.selectOption('stair_area');
  await expect(modal).toContainText('پاگردها یا توقف‌ها');
  await steps.nth(2).click();
  await save.click();
  await expect(page.getByText('توقف آسانسور غربی در طبقه منفی یک وابسته است.')).toBeVisible();
  await expect(modal).toBeVisible();
  await save.click();
  await expect(modal).toHaveCount(0);
  expect(writes[2]).toEqual({ meta: { area_type: 'stair_area', expected_area_type: 'corridor' } });
  await open();
  await expect(select).toHaveValue('stair_area');
  await select.selectOption('ramp_area');
  await select.selectOption('elevator_area');
  await steps.nth(2).click();
  await save.click();
  await expect(modal).toHaveCount(0);
  await open();
  await expect(select).toHaveValue('elevator_area');
});
