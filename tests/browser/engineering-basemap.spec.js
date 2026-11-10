import { test, expect } from '@playwright/test';
import { DEFAULT_NAVIGATION_POLICY } from '../../src/services/navigationPolicy.js';
// These pre-existing cases cover the optional GPS policy. Haram defaults are tested separately.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(policy => localStorage.setItem('navigation-policy-v1', JSON.stringify(policy)),
    { ...DEFAULT_NAVIGATION_POLICY, gps_enabled: true });
});

const floors = [{ floor: 0, label: 'همکف' }, { floor: -1, label: 'منفی ۱' }];
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

async function setup(page, state = null, browseFloor = 0) {
  await page.setViewportSize({ width: 430, height: 900 });
  await page.addInitScript(({ state, browseFloor }) => {
    sessionStorage.setItem('selectedMapType', 'satellite');
    sessionStorage.setItem('haramCurrentFloor', String(browseFloor));
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
    if (state) {
      localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
      for (const [key, value] of Object.entries(state)) {
        sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    }
  }, { state, browseFloor });
  await page.route('**/api/v1/**', async route => {
    const { pathname } = new URL(route.request().url());
    const data = pathname.endsWith('/floors') ? floors : { status: 'NO_MATCH', data: [], features: [] };
    await route.fulfill({ json: data });
  });
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.route('https://**/*', route => route.fulfill({ status: 204 }));
}

const waitForEngineeringTile = page => page.waitForRequest(request => {
  const url = new URL(request.url());
  return url.pathname.includes('/tiles/public.fn_public_engineering_map_mvt/') &&
    url.searchParams.get('p_floor') === '-1' && url.searchParams.get('p_lang') === 'fa';
});

const waitForSatelliteTile = page => page.waitForRequest(request =>
  new URL(request.url()).pathname.includes('/tms/'));

const expectRouteFloor = (page, floor) => expect.poll(() =>
  page.evaluate(() => Number(sessionStorage.getItem('haramCurrentFloor')))).toBe(floor);

async function chooseFloor(page, name) {
  await page.locator('.gp-floor-trigger').click();
  await page.locator('.gp-floor-option').filter({ hasText: name }).click();
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
