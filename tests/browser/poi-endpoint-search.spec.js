import { test, expect } from '@playwright/test';

const floors = [
  { floor: 1, label: 'طبقه ۱', sort_order: 1 },
  { floor: 0, label: 'همکف', sort_order: 0 },
  { floor: -1, label: 'منفی ۱', sort_order: -1 }
];
// Identical names/XY are intentional. No images, contents or category required.
const pois = [-1, 0, 1].map((floor, index) => ({
  id: String(101 + index), floor, title: 'رواق آزمایشی بدون محتوا',
  coordinates: [36.287, 59.615], image: null, content: null,
  subGroupValue: `poi-${101 + index}`, subGroup: 'ravaq'
}));

async function setup(page) {
  const errors = [], searches = [], areaRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('selectedMapType', 'base');
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    let json = { data: [], features: [], status: 'NO_MATCH' };
    if (url.pathname.endsWith('/floors')) json = floors;
    else if (url.pathname.endsWith('/groups/metadata')) json = { groups: [] };
    else if (url.pathname.endsWith('/groups/subgroups')) json = { subGroups: {} };
    else if (url.pathname.endsWith('/landmark-places')) {
      const searching = Boolean(url.searchParams.get('search'));
      if (searching) searches.push(Object.fromEntries(url.searchParams));
      json = { places: { landmarkPlaces: searching ? pois : [] } };
    } else if (url.pathname.endsWith('/area-doors')) areaRequests.push(Object.fromEntries(url.searchParams));
    await route.fulfill({ json });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }]
  } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  return { errors, searches, areaRequests };
}

for (const width of [360, 1280]) {
  for (const target of ['origin', 'destination']) {
    test(`${width}px ${target} search hides the floor picker and restores it for map selection`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 850 });
      const { errors, searches } = await setup(page);
      await page.goto('/#/mpr');
      const picker = page.locator('.gp-floor-trigger');
      await expect(picker).toBeVisible();
      await page.locator(target === 'origin' ? '.map-current-location' : '.map-destination-input-wrapper').click();
      const modal = page.locator('.map-search-modal');
      await expect(modal).toBeVisible();
      await expect(picker).toBeHidden();
      await expect(page.getByRole('button', { name: /^طبقهٔ نقشه:/ })).toHaveCount(0);
      await modal.locator('input').fill('رواق آزمایشی');
      const rows = page.locator('.map-destination-list li');
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText('منفی');
      await expect(rows.nth(1)).toContainText('همکف');
      await expect(rows.nth(2)).toContainText('۱');
      await expect(picker).toBeHidden();
      expect(searches.at(-1).floor).toBeUndefined();
      expect(searches.at(-1).featured).toBeUndefined();
      await page.screenshot({ path: testInfo.outputPath(`search-${target}-${width}.png`) });

      await modal.locator('input').fill('');
      await page.locator('.map-option-item').first().click();
      await expect(modal).toHaveCount(0);
      await expect(picker).toBeVisible();
      await picker.click();
      await page.locator('.gp-floor-option').filter({ hasText: 'منفی ۱' }).click();
      await expect(picker).toContainText('منفی ۱');
      await page.locator('.map-back-button').click();
      await expect(modal).toBeVisible();
      await expect(picker).toBeHidden();
      await page.locator('.map-modal-back-button').click();
      await expect(modal).toHaveCount(0);
      await expect(picker).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test('contentless POI search retains the independent negative origin and positive destination floors', async ({ page }) => {
  const { errors, searches, areaRequests } = await setup(page);
  const routeRequests = [];
  await page.route('**/api/v1/routing/route', route => {
    routeRequests.push(route.request().postDataJSON());
    return route.fulfill({ status: 404, json: { status: 'NO_PATH' } });
  });
  await page.goto('/#/mpr');
  await page.locator('.map-current-location').click();
  await page.locator('.map-search-modal input').fill('رواق آزمایشی');
  await expect(page.locator('.map-destination-list li')).toHaveCount(3);
  await page.locator('.map-destination-list li').first().click();
  await expect(page.locator('.map-current-location input')).toHaveValue(/منفی/);
  expect(searches.at(-1).include_exact_areas).toBe('1');
  await page.locator('.map-destination-input-wrapper').click();
  await expect(page.locator('.gp-floor-trigger')).toBeHidden();
  await page.locator('.map-search-modal input').fill('رواق آزمایشی');
  await expect(page.locator('.map-destination-list li')).toHaveCount(3);
  await page.locator('.map-destination-list li').last().click();
  expect(searches.at(-1).include_exact_areas).toBe('1');
  await expect(page.locator('.map-entry-location-name')).toHaveCount(0);
  await expect.poll(() => routeRequests.at(-1)).toMatchObject({ origin: { floor: -1 }, destination: { floor: 1 } });
  expect(areaRequests).toEqual([]);
  expect(errors).toEqual([]);
});

for (const target of ['origin', 'destination']) {
  test(`${target} search opens the area entrances and the separate cultural details`, async ({ page }) => {
    await setup(page);
    const area = { id: 'area-1000998', kind: 'area', areaId: 1000998, title: 'روضه منور', floor: 0, coordinates: [36.287, 59.615] };
    const cultural = {
      id: '890', title: 'روضه منوره', floor: 0, coordinates: [36.287, 59.615],
      content: { title: 'روضه منوره', body: 'متن فرهنگی آزمون' },
    };
    await page.route('**/api/v1/landmark-places?*', async route => {
      const params = new URL(route.request().url()).searchParams;
      let places = [];
      if (params.get('search') === cultural.title && params.get('include_exact_areas') === '1') {
        places = [area, { ...cultural, kind: 'cultural' }];
      } else if (params.get('poi_id') === cultural.id) {
        places = [cultural];
      }
      await route.fulfill({ json: { places: { landmarkPlaces: places } } });
    });

    await page.goto('/#/mpr');
    const trigger = target === 'origin' ? '.map-current-location' : '.map-destination-input-wrapper';
    await page.locator(trigger).click();
    const input = page.locator('.map-search-modal input');
    await input.fill(cultural.title);
    const rows = page.locator('.map-destination-list li');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('محدوده');
    await expect(rows.nth(1)).toContainText('اطلاعات فرهنگی');

    await rows.getByText(area.title, { exact: true }).click();
    await expect(page.getByRole('dialog', { name: area.title, exact: true })).toBeVisible();
    await page.locator('.map-entry-back-button').click();
    await input.fill(cultural.title);
    await rows.getByText(cultural.title, { exact: true }).click();
    await expect(page).toHaveURL(/#\/location\?id=890$/);
    await expect(page.getByRole('heading', { name: cultural.title, exact: true })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: 'متن فرهنگی آزمون' })).toBeVisible();
  });
}

test('partial origin search shows areas and POIs and starts at the selected access point', async ({ page }) => {
  const { errors } = await setup(page);
  const area = { id: 'area-45', kind: 'area', areaId: 45, title: 'صحن آزمایشی', floor: 1, coordinates: [36.288, 59.616] };
  const poi = { id: '502', title: 'کفشداری صحن آزمایشی', floor: 0, coordinates: [36.287, 59.615] };
  const door = { doorNo: 1, accessId: 94, selectedAreaId: 45, routingStatus: 'available', otherAreaName: 'راهرو', coord4326: [59.6165, 36.2875] };
  const areaRequests = [];
  const routeRequests = [];
  await page.route('**/api/v1/landmark-places**', route => {
    const { searchParams } = new URL(route.request().url());
    const term = searchParams.get('search');
    const places = searchParams.get('include_exact_areas') === '1' && ['صحن', area.title].includes(term)
      ? [area, poi] : [];
    return route.fulfill({ json: { places: { landmarkPlaces: places } } });
  });
  await page.route('**/api/v1/area-doors?*', route => {
    areaRequests.push(Object.fromEntries(new URL(route.request().url()).searchParams));
    return route.fulfill({ json: { status: 'ok', data: { area: { id: area.areaId, floor: area.floor }, doors: [door] } } });
  });
  await page.route('**/api/v1/routing/route', route => {
    routeRequests.push(route.request().postDataJSON());
    return route.fulfill({ status: 404, json: { status: 'NO_PATH' } });
  });

  await page.goto('/#/mpr');
  await page.locator('.map-current-location').click();
  const search = page.locator('.map-search-modal input');
  await search.fill('صحن');
  const rows = page.locator('.map-destination-list li');
  await expect(rows.first().getByRole('img', { name: 'محدوده' })).toBeVisible();
  await expect(rows.last().getByRole('img', { name: 'نقطهٔ شاخص' })).toBeVisible();
  await rows.first().click();
  await expect(page.locator('.map-entry-item')).toHaveCount(1);
  await expect(page.locator('.map-confirm-entry-button')).toBeDisabled();
  await page.locator('.map-entry-back-button').click();
  await expect(search).toHaveValue(area.title);
  await expect(search).toHaveAttribute('placeholder', /مبدا|مبدأ/);
  await rows.first().click();
  await page.locator('.map-entry-item').click();
  await page.locator('.map-confirm-entry-button').click();
  await expect(page.locator('.map-current-location input')).toHaveValue(new RegExp(area.title));
  expect(areaRequests).toEqual([
    { area_id: '45', floor: '1', lang: 'fa', mode: 'walk', gender: 'male' },
    { area_id: '45', floor: '1', lang: 'fa', mode: 'walk', gender: 'male' }
  ]);

  await page.locator('.map-destination-input-wrapper').click();
  await search.fill('صحن');
  await rows.getByText(poi.title, { exact: true }).click();
  await expect.poll(() => routeRequests.at(-1), { timeout: 30000 }).toMatchObject({
    origin: { name: area.title, type: 'door', accessId: 94, areaId: 45, lat: door.coord4326[1], lon: door.coord4326[0], floor: area.floor },
    destination: { name: poi.title, lat: poi.coordinates[0], lon: poi.coordinates[1], floor: poi.floor }
  });
  expect(errors).toEqual([]);
});

for (const selectArea of [false, true]) {
  test(`an exact area search uses ${selectArea ? 'only the selected area doors' : 'the selected internal POI point'}`, async ({ page }) => {
    const { errors } = await setup(page);
    const area = { id: 'area-45', kind: 'area', areaId: 45, title: 'صحن آزمایشی', floor: 1, coordinates: [36.288, 59.616] };
    const poi = { id: '502', title: 'کفشداری صحن آزمایشی', subGroup: 'sahn', floor: 1, coordinates: [36.287, 59.615] };
    const origin = { id: '501', title: 'مبدأ آزمایشی', floor: 0, coordinates: [36.286, 59.614] };
    const door = { doorNo: 1, accessId: 94, selectedAreaId: 45, routingStatus: 'available', otherAreaName: 'راهرو', coord4326: [59.6165, 36.2875] };
    const areaRequests = [];
    const routeRequests = [];
    await page.route('**/api/v1/landmark-places**', route => {
      const { searchParams } = new URL(route.request().url());
      const query = searchParams.get('search');
      const places = query === origin.title ? [origin]
        : query === area.title && searchParams.get('include_exact_areas') === '1' ? [area, poi] : [];
      return route.fulfill({ json: { places: { landmarkPlaces: places } } });
    });
    await page.route('**/api/v1/area-doors?*', route => {
      areaRequests.push(Object.fromEntries(new URL(route.request().url()).searchParams));
      return route.fulfill({ json: { status: 'ok', data: {
        area: {
          id: area.areaId, floor: area.floor, bbox4326: [59.615, 36.287, 59.617, 36.289],
          geometry: { type: 'Polygon', coordinates: [[
            [59.615, 36.287], [59.617, 36.287], [59.617, 36.289], [59.615, 36.289], [59.615, 36.287]
          ]] }
        },
        doors: [door]
      } } });
    });
    await page.route('**/api/v1/routing/route', route => {
      routeRequests.push(route.request().postDataJSON());
      return route.fulfill({ status: 404, json: { status: 'NO_PATH' } });
    });

    await page.goto('/#/mpr');
    await page.locator('.map-current-location').click();
    await page.locator('.map-search-modal input').fill(origin.title);
    await page.getByText(origin.title, { exact: true }).click();
    await page.locator('.map-destination-input-wrapper').click();
    await page.locator('.map-search-modal input').fill(area.title);
    const rows = page.locator('.map-destination-list li');
    await expect(rows.filter({ hasText: area.title }).first().getByRole('img', { name: 'محدوده' })).toBeVisible();
    await expect(rows.filter({ hasText: poi.title }).getByRole('img', { name: 'نقطهٔ شاخص' })).toBeVisible();
    const target = selectArea ? area : poi;
    await page.getByText(target.title, { exact: true }).click();
    if (selectArea) {
      await expect(page.locator('.map-entry-item')).toHaveCount(1);
      await expect(page.locator('.map-entry-item')).toContainText('راهرو');
      expect(areaRequests).toEqual([{ area_id: '45', floor: '1', lang: 'fa', mode: 'walk', gender: 'male' }]);
      expect(routeRequests).toEqual([]);
      await expect(page.locator('.gp-floor-trigger')).toContainText('۱');
      const marker = page.locator('.map-door-marker');
      await expect(marker).toHaveCount(1);
      await expect(marker).toContainText('1');
      await expect(marker).toHaveAccessibleName(/راهرو/);
      await marker.click();
      await expect(page.locator('.map-entry-item')).toHaveClass(/selected/);
      await page.locator('.map-confirm-entry-button').click();
    }
    await expect(page.locator('.map-entry-location-name')).toHaveCount(0);
    await expect(page.locator('.map-door-marker')).toHaveCount(0);
    const [lat, lon] = selectArea ? [...door.coord4326].reverse() : poi.coordinates;
    await expect.poll(() => routeRequests.length, { timeout: 30000 }).toBeGreaterThan(0);
    expect(routeRequests.at(-1).destination).toMatchObject({ name: target.title, lat, lon, floor: 1 });
    expect(areaRequests).toHaveLength(selectArea ? 1 : 0);
    expect(errors).toEqual([]);
  });
}

test('a grouped destination shows one row and requests the group entrances by its stable identity', async ({ page }) => {
  const { errors } = await setup(page);
  const title = 'رواق امام خمینی';
  const area = { id: 'area-group-imam-khomeini-riwaq', kind: 'area', areaGroupId: 'imam-khomeini-riwaq', title, floor: 0, coordinates: [36.2869, 59.6152] };
  const doors = [
    { doorNo: 1, accessId: 50600, routingStatus: 'closed', selectedAreaId: 123, otherAreaName: 'بست شیخ بهایی', coord4326: [59.61498, 36.2868] },
    { doorNo: 2, accessId: 50601, routingStatus: 'available', selectedAreaId: 123, otherAreaName: 'صحن بعثت', coord4326: [59.61525, 36.2869] },
  ];
  const areaRequests = [];
  await page.route('**/api/v1/landmark-places**', route => {
    const { searchParams } = new URL(route.request().url());
    const places = searchParams.get('search') === title && searchParams.get('include_exact_areas') === '1' ? [area] : [];
    return route.fulfill({ json: { places: { landmarkPlaces: places } } });
  });
  await page.route('**/api/v1/area-doors?*', route => {
    areaRequests.push(Object.fromEntries(new URL(route.request().url()).searchParams));
    return route.fulfill({ json: { status: 'ok', data: { area: { id: area.id, areaGroupId: area.areaGroupId, floor: 0 }, doors } } });
  });

  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  await page.locator('.map-search-modal input').fill(title);
  const results = page.locator('.map-destination-list li');
  await expect(results).toHaveCount(1);
  await results.first().click();
  const entries = page.locator('.map-entry-item');
  const markers = page.locator('.map-door-marker');
  await expect(entries).toHaveCount(2);
  await expect(markers).toHaveCount(2);
  await expect(entries.first()).toBeDisabled();
  await expect(entries.first()).toContainText('درب بسته است');
  await expect(markers.first()).toBeDisabled();
  expect(areaRequests).toEqual([{ area_group_id: area.areaGroupId, floor: '0', lang: 'fa', mode: 'walk', gender: 'male' }]);
  await expect(entries.nth(1)).toContainText('صحن بعثت');
  await entries.nth(1).click();
  await expect(markers.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.map-confirm-entry-button').click();
  await expect(page.locator('.map-entry-location-name')).toHaveCount(0);
  const selected = await page.evaluate(() => JSON.parse(sessionStorage.getItem('currentDestination')));
  expect(selected).toMatchObject({ areaGroupId: area.areaGroupId, floor: 0, coordinates: [36.2869, 59.61525], door: { accessId: 50601, selectedAreaId: 123 } });
  expect(errors).toEqual([]);
});

test('an area with no registered entrances keeps the message visible and allows returning to search', async ({ page }) => {
  const { errors } = await setup(page);
  const title = 'صحن جمهوری';
  const area = { id: 'area-1001379', kind: 'area', areaId: 1001379, title, floor: 0, coordinates: [36.286, 59.614] };
  await page.route('**/api/v1/landmark-places**', route => {
    const { searchParams } = new URL(route.request().url());
    const places = searchParams.get('search') === title ? [area] : [];
    return route.fulfill({ json: { places: { landmarkPlaces: places } } });
  });
  await page.route('**/api/v1/area-doors?*', route => route.fulfill({
    json: { status: 'ok', data: { area: { id: area.areaId, floor: area.floor }, doors: [] } }
  }));

  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  await page.locator('.map-search-modal input').fill(title);
  await page.getByText(title, { exact: true }).click();
  await expect(page.locator('.map-entry-location-name')).toHaveText(title);
  await expect(page.locator('.map-entry-message')).toContainText(/ورودی.*ثبت/);
  await expect(page.locator('.map-entry-item')).toHaveCount(0);
  await expect(page.locator('.map-door-marker')).toHaveCount(0);
  await expect(page.locator('.map-confirm-entry-button')).toBeDisabled();
  await page.locator('.map-entry-modal').getByRole('button', { name: /بازگشت/ }).click();
  await expect(page.locator('.map-search-modal')).toBeVisible();
  await expect(page.locator('.map-entry-location-name')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('currentDestination'))).toBeNull();
  expect(errors).toEqual([]);
});

test('map picks update both names while retaining the selected coordinates', async ({ page }) => {
  await setup(page);
  const lookups = [];
  const routes = [];
  const names = ['صحن پیامبر', 'صحن قدس', 'باب الجواد'];
  await page.route('**/api/v1/route-endpoint-label?*', route => {
    const point = Object.fromEntries(new URL(route.request().url()).searchParams);
    const index = lookups.length;
    lookups.push(point);
    return route.fulfill({ json: { label: { id: String(index), name: names[index], nearby: false } } });
  });
  await page.route('**/api/v1/routing/route', route => {
    routes.push(route.request().postDataJSON());
    return route.fulfill({ status: 404, json: { status: 'NO_PATH' } });
  });

  await page.goto('/#/mpr');
  async function pick(input, x) {
    await page.locator(input).click();
    await page.locator('.map-option-item').first().click();
    await page.locator('.maplibregl-canvas').first().click({ position: { x, y: 260 } });
  }
  const origin = '.map-current-location';
  await pick(origin, 360);
  await expect(page.locator(`${origin} input`)).toHaveValue(/صحن پیامبر/);
  await pick(origin, 480);
  await expect(page.locator(`${origin} input`)).toHaveValue(/صحن قدس/);
  await pick('.map-destination-input-wrapper', 600);

  await expect.poll(() => routes.at(-1)).toMatchObject({
    origin: { name: 'صحن قدس', lat: Number(lookups[1].lat), lon: Number(lookups[1].lon), floor: 0 },
    destination: { name: 'باب الجواد', lat: Number(lookups[2].lat), lon: Number(lookups[2].lon), floor: 0 }
  });
});

test('MPR previews accessible points near both requested POI endpoints', async ({ page }) => {
  const { errors } = await setup(page);
  const origin = [36.287920367423624, 59.611761238159666];
  const nearbyOrigin = [36.287941, 59.611782];
  const requested = [36.28829999643531, 59.61205093578388];
  const nearby = [36.288232287, 59.611934383];
  const instruction = 'به نزدیک‌ترین نقطهٔ قابل‌دسترسی به سقف کاذب رسیدید.';
  await page.route('**/api/v1/landmark-places**', route => {
    const search = new URL(route.request().url()).searchParams.get('search');
    const places = search === 'راهرو' ? [{ id: '1', title: 'راهرو', floor: 0, coordinates: origin }]
      : search === 'سقف کاذب' ? [{ id: '85', title: 'سقف کاذب', floor: 0, coordinates: requested }] : [];
    return route.fulfill({ json: { places: { landmarkPlaces: places } } });
  });
  await page.route('**/api/v1/routing/route', route => {
    expect(route.request().postDataJSON()).toMatchObject({
      allowNearbyDestination: true,
      origin: { lat: origin[0], lon: origin[1], floor: 0 },
      destination: { name: 'سقف کاذب', lat: requested[0], lon: requested[1], floor: 0 }
    });
    return route.fulfill({ json: {
      ok: true, status: 'OK', distanceMeters: 40.5, estimatedMinutes: 0.56,
      geo: { type: 'Feature', geometry: { type: 'LineString', coordinates: [
        [nearbyOrigin[1], nearbyOrigin[0]], [nearby[1], nearby[0]]
      ] }, properties: {
        nearbyOrigin: { coordinates: nearbyOrigin, floor: 0, label: { name: 'راهروی غربی', kind: 'area', nearby: false } },
        nearbyDestination: { coordinates: nearby, floor: 0, label: { name: 'باب الجواد', kind: 'door', nearby: false } }
      } },
      steps: [{ type: 'stepArriveDestination', coord: { lat: nearby[0], lon: nearby[1] },
        floor: 0, routeM: 1, instruction }],
      alternatives: []
    } });
  });

  await page.goto('/#/mpr');
  await page.locator('.map-current-location').click();
  await page.locator('.map-search-modal input').fill('راهرو');
  await page.locator('.map-destination-list li').filter({ hasText: 'راهرو' }).click();
  await page.locator('.map-destination-input-wrapper').click();
  await page.locator('.map-search-modal input').fill('سقف کاذب');
  await page.locator('.map-destination-list li').filter({ hasText: 'سقف کاذب' }).click();
  await expect(page).toHaveURL(/#\/fs/);
  await expect(page.locator('.location-input.origin-input')).toContainText('راهروی غربی');
  await expect(page.locator('.location-input.destination-input .location-name')).toContainText('سقف کاذب');
  await expect(page.locator('.location-input.destination-input .location-adjustment')).toHaveText('پایان مسیر: باب الجواد');
  await expect(page.locator('.route-summary')).toContainText('از راهروی غربی');
  await expect(page.locator('.route-summary')).toContainText('تا نزدیکی سقف کاذب');
  await page.locator('.overview-btn').click();
  await expect(page.locator('.instruction-text2')).toContainText(instruction);
  await page.goto('/#/rng');
  await expect(page.locator('.instruction-text')).toContainText(instruction);
  expect(errors).toEqual([]);
});

test('MPB text results also hide the map floor picker without requiring POI images', async ({ page }) => {
  const { errors } = await setup(page);
  await page.goto('/#/mpb');
  const picker = page.locator('.gp-floor-trigger');
  await expect(picker).toBeVisible();
  const input = page.locator('.gp-mapbegin input').first();
  await input.fill('رواق آزمایشی');
  await expect(page.locator('.search-modal3')).toBeVisible();
  await expect(picker).toBeHidden();
  await expect(page.locator('.search-result-card3')).toHaveCount(3);
  await input.fill('');
  await expect(page.locator('.search-modal3')).toHaveCount(0);
  await expect(picker).toBeVisible();
  expect(errors).toEqual([]);
});

for (const target of ['origin', 'destination']) {
  test(`${target} search keeps each address with its own POI across ordering and language`, async ({ page }) => {
    const { errors, areaRequests } = await setup(page);
    let reversed = false;
    await page.route('**/api/v1/landmark-places**', (route) => {
      const url = new URL(route.request().url());
      if (!url.searchParams.has('search')) return route.fulfill({ json: { places: { landmarkPlaces: [] } } });
      const items = [
        { id: '501', title: 'مکان الف', subGroupValue: 'shared', subGroup: 'عنوان نامرتبط', address: { fa: 'نشانی الف', en: 'Address A' }, floor: -1, coordinates: [36.287, 59.615] },
        { id: '502', title: 'مکان ب', subGroupValue: 'shared', subGroup: 'عنوان نامرتبط', address: { fa: 'نشانی ب', en: 'Address B' }, floor: 1, coordinates: [36.288, 59.616] },
        { id: '503', title: 'مکان بی نشانی', subGroupValue: 'shared', subGroup: 'عنوان نامرتبط', floor: 0, coordinates: [36.289, 59.617] }
      ];
      return route.fulfill({ json: { places: { landmarkPlaces: reversed ? items.reverse() : items } } });
    });
    await page.goto('/#/mpr');
    await page.locator(target === 'origin' ? '.map-current-location' : '.map-destination-input-wrapper').click();
    const input = page.locator('.map-search-modal input');
    await input.fill('مکان');
    const rows = page.locator('.map-destination-list li');
    await expect(rows).toHaveCount(3);
    const rowA = rows.filter({ hasText: 'مکان الف' });
    const rowB = rows.filter({ has: page.locator('.map-destination-name', { hasText: /^مکان ب$/ }) });
    const missing = rows.filter({ hasText: 'مکان بی نشانی' });
    await expect(rowA.locator('.map-destination-location')).toContainText('نشانی الف');
    await expect(rowA).toContainText('منفی');
    await expect(rowB.locator('.map-destination-location')).toContainText('نشانی ب');
    await expect(rowB).toContainText('۱');
    await expect(missing).not.toContainText('عنوان نامرتبط');
    reversed = true;
    await input.fill('مکان ب');
    await expect(rows.first()).toContainText('مکان بی نشانی');
    await expect(rowA.locator('.map-destination-location')).toContainText('نشانی الف');
    await expect(rowB.locator('.map-destination-location')).toContainText('نشانی ب');
    await page.evaluate(async () => { const { useLangStore } = await import('/src/store/langStore.js'); useLangStore.getState().setLanguage('en'); });
    await expect(rowA.locator('.map-destination-location')).toContainText('Address A');
    await expect(rowB.locator('.map-destination-location')).toContainText('Address B');
    await rowB.click();
    if (target === 'origin') await expect(page.locator('.map-current-location input')).toHaveValue(/مکان ب/);
    else await expect(page.locator('.map-destination-input-wrapper input')).toHaveValue(/مکان ب/);
    expect(areaRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('legacy recent searches retain entries and recover only their own saved addresses', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('recent-search-storage', JSON.stringify({ version: 1, state: { recentSearches: [
    { id: '501', name: 'مکان الف', location: 'عنوان اشتباه مشترک', address: 'نشانی الف', floor: -1, coordinates: [36.287, 59.615] },
    { id: 'shared', name: 'مکان بدون نشانی', location: 'عنوان اشتباه مشترک', floor: 1, coordinates: [36.288, 59.616] }
  ] } })));
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  const rows = page.locator('.map-destination-list li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.map-destination-location')).toContainText('نشانی الف');
  await expect(rows.nth(1)).not.toContainText('عنوان اشتباه مشترک');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('recent-search-storage')));
  expect(saved.state.recentSearches).toHaveLength(2);
  expect(saved.state.recentSearches[0].coordinates).toEqual([36.287, 59.615]);
  expect(JSON.stringify(saved)).not.toContain('عنوان اشتباه مشترک');
});

test('reusing a legacy POI selection restores its original coordinates', async ({ page }) => {
  const { areaRequests } = await setup(page);
  const place = { id: '275', title: 'وضوخانه برادران', floor: 0, coordinates: [36.286403424, 59.615193275] };
  const oldDoor = { doorNo: 1, accessId: 51077, coord4326: [59.615085741, 36.286440840] };
  await page.addInitScript(({ place, oldDoor }) => {
    localStorage.setItem('recent-search-storage', JSON.stringify({ version: 2, state: { recentSearches: [{
      id: place.id, poiId: place.id, name: place.title, floor: place.floor,
      addressLanguage: 'fa', coordinates: [...oldDoor.coord4326].reverse(), entry: 1, door: oldDoor
    }] } }));
  }, { place, oldDoor });
  const lookups = [];
  await page.route('**/api/v1/landmark-places**', route => {
    const { searchParams } = new URL(route.request().url());
    const poiId = searchParams.get('poi_id');
    if (poiId) lookups.push(poiId);
    return route.fulfill({ json: { places: { landmarkPlaces: poiId === place.id ? [place] : [] } } });
  });
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  await page.getByText(place.title, { exact: true }).click();
  await expect(page.locator('.map-destination-input-wrapper input')).toHaveValue(/وضوخانه برادران/);
  const stored = await page.evaluate(() => ({
    selected: JSON.parse(sessionStorage.getItem('currentDestination')),
    recent: JSON.parse(localStorage.getItem('recent-search-storage')).state.recentSearches
  }));
  expect(lookups).toEqual([place.id]);
  expect(areaRequests).toEqual([]);
  expect(stored.selected.coordinates).toEqual(place.coordinates);
  expect(stored.selected).not.toHaveProperty('door');
  expect(stored.recent).toHaveLength(1);
  expect(stored.recent[0].coordinates).toEqual(place.coordinates);
});

test('recent POI addresses refresh in the selected language by entity ID', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('recent-search-storage', JSON.stringify({ version: 2, state: { recentSearches: [
    { id: '501', poiId: '501', name: 'مکان الف', address: 'نشانی الف', location: 'نشانی الف', addressLanguage: 'fa', floor: 0, coordinates: [36.287, 59.615] }
  ] } })));
  const lookups = [];
  await page.route('**/api/v1/landmark-places**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('poi_id')) {
      lookups.push([url.searchParams.get('poi_id'), url.searchParams.get('language')]);
      return route.fulfill({ json: { places: { landmarkPlaces: [{ id: '501', address: 'Address A' }] } } });
    }
    return route.fulfill({ json: { places: { landmarkPlaces: [] } } });
  });
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  await expect(page.locator('.map-destination-list li')).toContainText('نشانی الف');
  await page.evaluate(async () => { const { useLangStore } = await import('/src/store/langStore.js'); useLangStore.getState().setLanguage('en'); });
  await expect(page.locator('.map-destination-list li')).toContainText('Address A');
  expect(lookups).toContainEqual(['501', 'en']);
});

test('subgroup selection keeps the selected metadata when values coincide', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/groups/metadata**', route => route.fulfill({ json: { groups: [{ value: 'testgroup', label: { fa: 'گروه آزمایش' } }] } }));
  await page.route('**/api/v1/groups/subgroups**', route => route.fulfill({ json: { subGroups: { testgroup: [
    { value: 'shared', label: { fa: 'زیرگروه اول' }, address: { fa: 'نشانی اول' }, floor: 0, coordinates: [36.287, 59.615] },
    { value: 'shared', label: { fa: 'زیرگروه دوم' }, address: { fa: 'نشانی دوم' }, floor: 1, coordinates: [36.288, 59.616] }
  ] } } }));
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  await page.locator('.map-category-item2').filter({ hasText: 'گروه آزمایش' }).click();
  const choices = page.locator('.subgroup-search-item');
  await expect(choices).toHaveCount(2);
  await expect(choices.nth(0)).toContainText('زیرگروه اول');
  await expect(choices.nth(1)).toContainText('زیرگروه دوم');
  await choices.nth(1).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('recent-search-storage'))?.state?.recentSearches?.[0]?.location)).toBe('نشانی دوم');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('recent-search-storage')).state.recentSearches[0]);
  expect(saved.name).toBe('زیرگروه دوم');
  expect(saved.floor).toBe(1);
});

for (const target of ['origin', 'destination']) {
  test(`${target} search hides repeated titles while retaining useful addresses and real floors`, async ({ page }) => {
    await setup(page);
    await page.route('**/api/v1/landmark-places**', (route) => {
      const url = new URL(route.request().url());
      const items = [
        { id: '201', title: 'چایخانه کوثر', address: '  چایخانه   كوثر  ', floor: 0, coordinates: [36.287, 59.615] },
        { id: '202', title: 'چایخانه غدیر', address: 'صحن غدیر، ضلع غربی', floor: 1, coordinates: [36.288, 59.616] },
        { id: '203', title: 'چایخانه رضوان', address: 'چایخانه رضوان', floor: null, coordinates: [36.289, 59.617] },
        { id: '204', title: 'چایخانه دیگر', address: '', floor: -1, coordinates: [36.290, 59.618] }
      ];
      return route.fulfill({ json: { places: { landmarkPlaces: url.searchParams.has('search') ? items : [] } } });
    });
    await page.goto('/#/mpr');
    await page.locator(target === 'origin' ? '.map-current-location' : '.map-destination-input-wrapper').click();
    await page.locator('.map-search-modal input').fill('چایخانه');
    const rows = page.locator('.map-destination-list li');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0).locator('.map-destination-location')).toHaveText('همکف');
    await expect(rows.nth(1).locator('.map-destination-location')).toContainText('صحن غدیر، ضلع غربی');
    await expect(rows.nth(1).locator('.map-destination-location')).toContainText('طبقه');
    await expect(rows.nth(2).locator('.map-destination-location')).toBeEmpty();
    await expect(rows.nth(3).locator('.map-destination-location')).toHaveText('طبقهٔ منفی ۱');
  });
}

test('recent search hides only the repeated address without altering stored data', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('recent-search-storage', JSON.stringify({ version: 2, state: { recentSearches: [
    { id: '201', poiId: '201', name: 'چایخانه کوثر', location: 'چایخانه کوثر', address: 'چایخانه کوثر', addressLanguage: 'fa', floor: 0, coordinates: [36.287, 59.615] },
    { id: '202', poiId: '202', name: 'چایخانه غدیر', location: 'صحن غدیر', address: 'صحن غدیر', addressLanguage: 'fa', floor: 1, coordinates: [36.288, 59.616] }
  ] } })));
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  const rows = page.locator('.map-destination-list li');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.map-destination-location')).toHaveText('همکف');
  await expect(rows.nth(1).locator('.map-destination-location')).toContainText('صحن غدیر');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('recent-search-storage')).state.recentSearches);
  expect(stored[0].address).toBe('چایخانه کوثر');
  expect(stored[0].coordinates).toEqual([36.287, 59.615]);
});

test('save-location search uses the normalized matches returned by the server', async ({ page }) => {
  const { searches, errors } = await setup(page);
  await page.goto('/#/pmap');
  await page.locator('.pmap-search-input').click();
  await page.locator('.pmap-search-modal input').fill('رواق آزمايشي');
  const row = page.locator('.pmap-destination-list li');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(pois[1].title);
  await expect(row.getByRole('img', { name: 'نقطهٔ شاخص' })).toBeVisible();
  expect(searches.at(-1)).toMatchObject({ language: 'fa', search: 'رواق آزمايشي' });
  expect(errors).toEqual([]);
});


for (const endpoint of ['origin', 'destination']) {
  test('explicit door replacement requires consent at the ' + endpoint, async ({ page }) => {
    await setup(page);
    const doorPoint = { name: 'صحن قدس', floor: 0, coordinates: [36.28701, 59.61459],
      door: { accessId: 50581, selectedAreaId: 1000006 } };
    const ordinaryPoint = { name: 'رواق حر عاملی', floor: -1, coordinates: [36.28784, 59.61688] };
    await page.addInitScript(({ endpoint, doorPoint, ordinaryPoint }) => {
      const origin = endpoint === 'origin' ? doorPoint : ordinaryPoint;
      const destination = endpoint === 'destination' ? doorPoint : ordinaryPoint;
      localStorage.setItem('route-storage', JSON.stringify({ version: 1, state: { origin, destination } }));
    }, { endpoint, doorPoint, ordinaryPoint });
    const requests = [];
    const replacement = { accessId: 51210, areaId: 1000006, doorId: 2000906, floor: 0,
      name: 'ورودی شرقی', coordinates: [36.28696, 59.61415], distanceMeters: 39.94 };
    await page.route('**/api/v1/routing/route', route => {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (body[endpoint]?.accessId === 50581) {
        return route.fulfill({ status: 409, json: { status: 'DOOR_UNAVAILABLE', endpoint, reason: 'closed', replacement } });
      }
      return route.fulfill({ status: 404, json: { status: 'NO_PATH' } });
    });

    const rejected = page.waitForEvent('dialog').then(async dialog => {
      expect(dialog.message()).toContain(replacement.name);
      await dialog.dismiss();
    });
    await page.goto('/#/fs');
    await rejected;
    await expect(page.getByText('درب بسته است', { exact: true })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0][endpoint]).toMatchObject({ type: 'door', accessId: 50581, areaId: 1000006, floor: 0 });

    const accepted = page.waitForEvent('dialog').then(dialog => dialog.accept());
    await page.reload();
    await accepted;
    await expect.poll(() => requests.at(-1)?.[endpoint]).toMatchObject({
      type: 'door', accessId: 51210, areaId: 1000006, floor: 0
    });
  });
}
