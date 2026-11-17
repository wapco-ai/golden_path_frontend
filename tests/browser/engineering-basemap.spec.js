import { test, expect } from '@playwright/test';
import { DEFAULT_NAVIGATION_POLICY } from '../../src/services/navigationPolicy.js';
// These pre-existing cases cover the optional GPS policy. Haram defaults are tested separately.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(policy => localStorage.setItem('navigation-policy-v1', JSON.stringify(policy)),
    { ...DEFAULT_NAVIGATION_POLICY, gps_enabled: true });
});

const floors = [{ floor: 1, label: 'طبقه ۱' }, { floor: 0, label: 'همکف' }, { floor: -1, label: 'منفی ۱' }];
const a = [59.61244, 36.28708];
const b = [59.61246, 36.28712];
const c = [59.61269, 36.28729];
const d = [59.61277, 36.28731];
const asLatLon = ([lon, lat]) => [lat, lon];
const line = coordinates => ({ type: 'LineString', coordinates });
const walk = (id, floor, coordinates) => ({
  id, kind: 'walk', floor, geometry: line(coordinates), duration_s: 10, distance_m: 8
});
const start = (floor, segmentId, points) => ({
  type: 'stepStart', floor, segmentId, routeM: 0,
  coordinates: points.map(asLatLon), instruction: 'شروع حرکت'
});

function routeFixture(from, to) {
  const first = from === -1 ? [a, b] : [d, c];
  const last = to === 0 ? [c, d] : [b, a];
  const multifloor = from !== to;
  const segments = [walk(0, from, first)];
  const steps = [start(from, 0, first)];
  if (multifloor) {
    segments.push({ id: 1, kind: 'ramp', floor: from, fromFloor: from, toFloor: to,
      geometry: null, duration_s: 30, distance_m: 0 }, walk(2, to, last));
    steps.push({ type: 'stepChangeFloor', floor: from, fromFloor: from, toFloor: to,
      segmentId: 1, routeM: 0, duration_s: 30, coordinates: [first[1], last[0]].map(asLatLon),
      instruction: 'از رمپ عبور کنید' }, start(to, 2, last));
  }
  const end = multifloor ? last[1] : first[1];
  steps.push({ type: 'stepArriveDestination', floor: to, segmentId: multifloor ? 2 : 0, routeM: 1,
    coordinates: [end, end].map(asLatLon), instruction: 'به مقصد رسیدید' });
  return {
    origin: { name: 'مبدأ آزمایشی', floor: from, coordinates: asLatLon(first[0]) },
    destination: { name: 'مقصد آزمایشی', floor: to, coordinates: asLatLon(end) },
    routeGeo: { type: 'Feature',
      geometry: multifloor ? { type: 'MultiLineString', coordinates: [first, last] } : line(first),
      properties: { multifloor, floor: from, segments, distanceMeters: 16, durationSeconds: 50 } },
    routeSteps: steps, alternativeRoutes: [], transportMode: 'walking', gender: 'both'
  };
}

async function setup(page, state = null, browseFloor = 0, mapType = 'satellite') {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.addInitScript(({ state, browseFloor, mapType }) => {
    if (!sessionStorage.getItem('selectedMapType')) sessionStorage.setItem('selectedMapType', mapType);
    if (!sessionStorage.getItem('haramCurrentFloor')) sessionStorage.setItem('haramCurrentFloor', String(browseFloor));
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
    if (state) {
      localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
      for (const [key, value] of Object.entries(state)) {
        sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    }
  }, { state, browseFloor, mapType });
  await page.route('**/api/v1/**', async route => {
    const { pathname } = new URL(route.request().url());
    const data = pathname.endsWith('/floors') ? floors : { status: 'NO_MATCH', data: [], features: [] };
    await route.fulfill({ json: data });
  });
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.route('https://**/*', route => route.fulfill({ status: 204 }));
}

const waitForEngineeringTile = (page, floor = -1) => page.waitForRequest(request => {
  const url = new URL(request.url());
  return url.pathname.includes('/tiles/public.fn_public_engineering_map_mvt/') &&
    url.searchParams.get('p_floor') === String(floor) && url.searchParams.get('p_lang') === 'fa';
});

const waitForSatelliteTile = page => page.waitForRequest(request =>
  new URL(request.url()).pathname.includes('/tms/'));

const expectRouteFloor = (page, floor) => expect.poll(() =>
  page.evaluate(() => Number(sessionStorage.getItem('haramCurrentFloor')))).toBe(floor);

async function chooseFloor(page, name) {
  await page.locator('.gp-floor-trigger').click();
  await page.locator('.gp-floor-option').filter({ hasText: name }).click();
}

async function observeMap(page, screen) {
  await page.goto('/#/');
  await page.evaluate(async screen => {
    const source = await (await fetch('/src/components/map/Mpbc.jsx')).text();
    const modulePath = source.match(/["']([^"']*\/maplibre-gl\.js\?[^"']+)["']/)?.[1];
    if (!modulePath) throw new Error('MapLibre module not found');
    const lib = (await import(modulePath)).default;
    const on = lib.Map.prototype.on;
    lib.Map.prototype.on = function (...args) {
      window.__engineeringMap = this;
      return on.apply(this, args);
    };
    window.location.hash = `#/${screen}`;
  }, screen);
  await expect.poll(() => page.evaluate(() => Boolean(window.__engineeringMap?.isStyleLoaded()))).toBe(true);
}

const readCamera = page => page.evaluate(() => {
  const map = window.__engineeringMap;
  return [map.getCenter().lng, map.getCenter().lat, map.getZoom(), map.getBearing()];
});

for (const screen of ['mpb', 'mpr']) {
  test(`${screen} middle option selects engineering geometry on the displayed floor`, async ({ page }) => {
    test.slow(); // Several complete style/floor changes, including a reload, under software rendering.
    await setup(page);
    const routeRequests = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname.endsWith('/routing/route')) routeRequests.push(request.postData());
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await observeMap(page, screen);
    const box = await page.locator('.maplibregl-canvas').boundingBox();
    const initialCamera = await readCamera(page);
    await page.mouse.move(box.x + 180, box.y + 120);
    await page.mouse.down();
    await page.mouse.move(box.x + 100, box.y + 160, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await readCamera(page))[0]).not.toBe(initialCamera[0]);
    await page.mouse.wheel(0, -300);
    await expect.poll(async () => (await readCamera(page))[2]).not.toBe(initialCamera[2]);
    await expect.poll(() => page.evaluate(() => window.__engineeringMap.isMoving())).toBe(false);
    const before = await readCamera(page);
    await page.locator(screen === 'mpb' ? '.map-style-button-mpb' : '.map-style-button-mpr').click();
    const options = page.locator('.map-style-menu-mpr .map-style-option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(1)).toHaveAttribute('title', 'نقشهٔ مهندسی');
    await expect(options.nth(1).locator('img')).toHaveAttribute('src', /engineering-map/);
    const groundTile = waitForEngineeringTile(page, 0);
    await options.nth(1).click();
    await groundTile;
    const camera = await readCamera(page);
    for (const [i, expected] of before.entries()) expect(camera[i]).toBeCloseTo(expected, 5);
    expect(await page.evaluate(() => sessionStorage.getItem('selectedMapType'))).toBe('base');

    for (const [name, floor] of [['طبقه ۱', 1], ['منفی ۱', -1], ['همکف', 0]]) {
      const nextTile = waitForEngineeringTile(page, floor);
      await chooseFloor(page, name);
      await nextTile;
    }
    const restoredTile = waitForEngineeringTile(page, 0);
    await page.reload();
    await restoredTile;
    await expect(page.locator('.gp-floor-trigger')).toContainText('همکف');
    const basementTile = waitForEngineeringTile(page);
    await chooseFloor(page, 'منفی ۱');
    await basementTile;
    await page.locator(screen === 'mpb' ? '.map-style-button-mpb' : '.map-style-button-mpr').click();
    await page.locator('.map-style-menu-mpr .map-style-option').first().click();
    const satelliteTile = waitForSatelliteTile(page);
    await chooseFloor(page, 'همکف');
    await satelliteTile;
    expect(routeRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const screen of ['fs', 'rop', 'rng']) {
  test(`${screen} keeps the engineering selection and the server route on ground floor`, async ({ page }) => {
    const state = routeFixture(0, 0);
    await setup(page, state, 0, 'base');
    const tile = waitForEngineeringTile(page, 0);
    await observeMap(page, screen);
    await tile;
    await expect(page.locator('.maplibregl-canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const layers = window.__engineeringMap.getStyle().layers;
      return layers.some(layer => layer.type === 'line' && /route/.test(layer.source));
    })).toBe(true);
    const routes = await page.evaluate(() => {
      const map = window.__engineeringMap;
      return Object.entries(map.getStyle().sources).filter(([id, source]) => /route/.test(id) && source.type === 'geojson')
        .map(([, source]) => source.data);
    });
    expect(JSON.stringify(routes)).toContain(String(state.routeGeo.geometry.coordinates[0][0]));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('route-storage')).state);
    expect(stored.routeGeo).toEqual(state.routeGeo);
    expect(stored.routeSteps).toEqual(state.routeSteps);
    expect(stored.origin).toEqual(state.origin);
    expect(stored.destination).toEqual(state.destination);
  });
}

for (const screen of ['mpb', 'mpr', 'fs']) {
  test(`${screen} requests the engineering basemap on a manual basement switch`, async ({ page }) => {
    await setup(page, screen === 'fs' ? routeFixture(0, -1) : null);
    await page.goto(`/#/${screen}`);
    const engineeringTile = waitForEngineeringTile(page);
    await chooseFloor(page, 'منفی ۱');
    await engineeringTile;
    await expect(page.locator('.gp-floor-trigger')).toContainText('منفی ۱');
    const groundTile = waitForSatelliteTile(page);
    await chooseFloor(page, 'همکف');
    await groundTile;
    await expect(page.locator('.gp-floor-trigger')).toContainText('همکف');
    expect(await page.evaluate(() => sessionStorage.getItem('selectedMapType'))).toBe('satellite');
  });
}

test('pmap follows the selected floor without an extra floor chooser', async ({ page }) => {
  await setup(page, null, -1);
  const engineeringTile = waitForEngineeringTile(page);
  await page.goto('/#/pmap');
  await engineeringTile;
  const groundStyle = page.waitForRequest('**/map-styles/osm-voyager/style.json');
  await page.evaluate(() => {
    sessionStorage.setItem('haramCurrentFloor', '0');
    window.dispatchEvent(new CustomEvent('haram-floor-change', { detail: { floor: 0 } }));
  });
  await groundStyle;
});

for (const [screen, next, instruction] of [
  ['rop', '.carousel-next', '.instruction-text2'],
  ['rng', '.direction-icon-rng', '.instruction-text']
]) {
  test(`${screen} uses the basement map for an entire basement route`, async ({ page }) => {
    await setup(page, routeFixture(-1, -1));
    const engineeringTile = waitForEngineeringTile(page);
    await page.goto(`/#/${screen}`);
    await engineeringTile;
    await expectRouteFloor(page, -1);
    await expect(page.locator(instruction)).toContainText('به مقصد رسیدید');
  });

  for (const from of [-1, 0]) {
    const to = from === -1 ? 0 : -1;
    test(`${screen} changes the basemap after the transfer step from ${from} to ${to}`, async ({ page }) => {
      await setup(page, routeFixture(from, to), to);
      const firstTile = from === -1 ? waitForEngineeringTile(page) : waitForSatelliteTile(page);
      await page.goto(`/#/${screen}`);
      await firstTile;
      await expectRouteFloor(page, from);
      await page.locator(next).click();
      await expect(page.locator(instruction)).toContainText('از رمپ عبور کنید');
      await expectRouteFloor(page, from);
      const nextTile = to === -1 ? waitForEngineeringTile(page) : waitForSatelliteTile(page);
      await page.locator(next).click();
      await nextTile;
      await expectRouteFloor(page, to);
    });
  }
}

test('live navigation keeps the basement basemap until the user confirms the transfer', async ({ page, context }) => {
  await setup(page, routeFixture(-1, 0));
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: a[0], latitude: a[1], accuracy: 5 });
  const engineeringTile = waitForEngineeringTile(page);
  await page.goto('/#/rng');
  await engineeringTile;
  await page.evaluate(async () => {
    const { default: service } = await import('/src/services/AdvancedDeadReckoningService.js');
    service.start = async () => {};
  });
  await page.locator('.start-routing-button').click();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  await context.setGeolocation({ longitude: b[0], latitude: b[1], accuracy: 5 });
  const confirm = page.getByRole('button', { name: 'تأیید رسیدن به طبقه مقصد' });
  await expect(confirm).toBeVisible();
  await expectRouteFloor(page, -1);
  await context.setGeolocation({ longitude: c[0], latitude: c[1], accuracy: 5 });
  await expect(confirm).toBeVisible();
  await expectRouteFloor(page, -1);
  const groundTile = waitForSatelliteTile(page);
  await confirm.click();
  await groundTile;
  await expectRouteFloor(page, 0);
});
