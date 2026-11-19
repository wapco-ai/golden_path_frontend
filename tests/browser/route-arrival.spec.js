import { test, expect } from '@playwright/test';
import { normalizeRouteSnapshot } from '../../src/services/routingService.js';

const coordinates = [[59.615, 36.287], [59.6151, 36.287], [59.6152, 36.287]];
const origin = { name: 'مبدأ', floor: 0, coordinates: [36.287, 59.615] };
const destination = { name: 'مقصد آزمایشی', floor: 0, coordinates: [36.287, 59.6152] };

function routeFixture({ arrivalM, finalDoor = false, direct = false, durationSeconds }) {
  const steps = [
    { type: 'stepStart', title: 'شروع حرکت', coord: { lat: 36.287, lon: 59.615 }, routeM: 0, floor: 0, segmentId: 0,
      duration_s: durationSeconds },
    ...(direct ? [] : [{ type: 'stepPassDoor', title: 'درگاه آزمایشی', instruction: 'از درگاه آزمایشی عبور کنید',
      coord: { lat: 36.287, lon: finalDoor ? 59.6152 : 59.6151 }, routeM: finalDoor ? 1 : 0.5,
      doorId: 7, floor: 0, segmentId: 0 }]),
    { type: 'stepArriveDestination', title: '', coord: { lat: 36.287, lon: 59.6152 },
      ...(arrivalM === undefined ? {} : { routeM: arrivalM }), floor: 0, segmentId: 0 }
  ];
  return { status: 'OK', multifloor: false, duration_s: durationSeconds, geo: { type: 'Feature',
    geometry: { type: 'LineString', coordinates }, properties: { multifloor: false } }, steps, alternatives: [] };
}

function multifloorRouteFixture() {
  const route = routeFixture({ direct: true, arrivalM: 1, durationSeconds: 56 });
  const [start, landing, end] = coordinates;
  const point = ([lon, lat]) => ({ lat, lon });
  const [first, arrival] = route.steps;
  return { ...route, multifloor: true, geo: { type: 'Feature',
    geometry: { type: 'MultiLineString', coordinates: [[start, landing], [landing, end]] },
    properties: { multifloor: true, distanceMeters: 20, durationSeconds: 56, segments: [
      { id: 0, kind: 'walk', floor: -1, geometry: { type: 'LineString', coordinates: [start, landing] }, duration_s: 10 },
      { id: 1, kind: 'elevator', floor: -1, fromFloor: -1, toFloor: 0, geometry: null, duration_s: 36 },
      { id: 2, kind: 'walk', floor: 0, geometry: { type: 'LineString', coordinates: [landing, end] }, duration_s: 10 }
    ] } }, steps: [
    { ...first, floor: -1 },
    { type: 'stepChangeFloor', coord: point(landing), segmentId: 1, floor: -1, fromFloor: -1, toFloor: 0,
      instruction: 'با آسانسور به طبقه همکف بروید.' },
    { ...first, coord: point(landing), segmentId: 2, instruction: 'حرکت در طبقه همکف' },
    { ...arrival, segmentId: 2, instruction: '   ' }
  ] };
}

async function setupRoute(page, options) {
  const raw = options.multifloor ? multifloorRouteFixture() : routeFixture(options);
  const routeOrigin = { ...origin, floor: options.multifloor ? -1 : 0 };
  const routeDestination = { ...destination, ...options.destination };
  raw.alternatives = options.alternatives || [];
  const snapshot = normalizeRouteSnapshot(raw, routeOrigin, routeDestination);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ origin, destination, snapshot, stored }) => {
    const state = { origin, destination, transportMode: 'walking', gender: 'both', alternativeRoutes: snapshot.alternatives,
      routeGeo: stored ? snapshot.geo : null, routeSteps: stored ? snapshot.steps : [] };
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
    sessionStorage.setItem('haramCurrentFloor', String(origin.floor));
    if (stored) {
      sessionStorage.setItem('routeGeo', JSON.stringify(snapshot.geo));
      sessionStorage.setItem('routeSteps', JSON.stringify(snapshot.steps));
      sessionStorage.setItem('alternativeRoutes', JSON.stringify(snapshot.alternatives));
    }
  }, { origin: routeOrigin, destination: routeDestination, snapshot, stored: options.stored });
  await page.route('**/api/v1/**', route => route.fulfill({ json: { status: 'NO_MATCH', data: [], features: [] } }));
  await page.route('**/api/v1/routing/route', route => route.fulfill({ json: raw }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  return errors;
}

test.describe('RNG mobile arrival preview', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const multifloor of [false, true]) {
    for (const name of [destination.name, undefined]) {
      const floors = multifloor ? 'multifloor' : 'same-floor';
      const destinationType = name ? 'named' : 'unnamed';
      test(`RNG previews the ${floors} arrival for a ${destinationType} destination`, async ({ page }) => {
        const errors = await setupRoute(page, { multifloor, stored: true, arrivalM: 1, destination: { name } });
        await page.goto('/#/rng');
        const icon = page.locator('.direction-icon-rng');
        const screen = page.locator('.routing-page');
        const lastIndex = multifloor ? 3 : 1;
        for (let index = 1; index <= lastIndex; index++) {
          await icon.click();
          await expect(screen).toHaveAttribute('data-current-step', String(index));
        }
        await expect(page.locator('.current-guide .instruction-text')).toHaveText(`رسیدن به ${name || 'مقصد'}`);
        expect(errors).toEqual([]);
      });
    }
  }
});

test('summary and single step display the short duration from the routing response', async ({ page }) => {
  await setupRoute(page, { direct: true, arrivalM: 1, durationSeconds: 9.4 });
  await page.goto('/#/fs');
  await expect(page.locator('.info-time span')).toHaveText('۹ ثانیه');
  await expect(page.locator('.main-popup')).toHaveText('۹ ثانیه');
  await page.locator('.overview-btn').click();
  await expect(page.locator('.time-value')).toHaveText('۹ ثانیه');
  await expect(page.locator('.main-popup')).toHaveText('۹ ثانیه');
});

test('RNG keeps server durations and raw steps when selecting another route and switching back', async ({ page }) => {
  const alternative = routeFixture({ arrivalM: 1, durationSeconds: 18 });
  alternative.steps[0].elapsed_s = 0;
  alternative.steps[1].routeM = 0.37;
  alternative.steps[1].elapsed_s = 8;
  alternative.steps[2].elapsed_s = 18;
  const expectedSteps = normalizeRouteSnapshot(alternative, origin, destination).steps;
  await setupRoute(page, { stored: true, direct: true, arrivalM: 1, durationSeconds: 6, alternatives: [alternative] });
  await page.goto('/#/rng');
  const stepTime = page.locator('.current-guide .step-time');
  await expect(stepTime).toHaveText('(6 ثانیه)');
  const otherRoutes = page.getByRole('button', { name: /سایر مسیرها/u });
  const alternativeCard = page.locator('.alternative-route-card');

  await otherRoutes.click();
  await expect(alternativeCard).toContainText('۱۸ ثانیه');
  await alternativeCard.click();
  await expect(stepTime).toHaveText('(8 ثانیه)');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('routeSteps')))).toEqual(expectedSteps);

  await otherRoutes.click();
  await expect(alternativeCard).toContainText('۶ ثانیه');
  await alternativeCard.click();
  await expect(stepTime).toHaveText('(6 ثانیه)');
});

for (const [screen, viewport] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }]
]) {
  test.describe(screen, () => {
    test.use({ viewport });
    for (const scenario of [
      { name: 'stored route with a missing arrival position', stored: true },
      { name: 'fresh API route with a null arrival position', stored: false, arrivalM: null },
      { name: 'current API arrival position', stored: true, arrivalM: 1 },
      { name: 'final door at the destination', stored: true, arrivalM: 1, finalDoor: true },
      { name: 'direct route without doors', stored: true, direct: true }
    ]) {
      test(`ROP reaches the final arrival for ${scenario.name}`, async ({ page }) => {
        const errors = await setupRoute(page, scenario);
        await page.goto('/#/rop');
        await expect(page.locator('.instruction-text2')).toBeVisible();
        if (!scenario.direct) {
          await expect(page.locator('.instruction-text2')).toContainText('از درگاه آزمایشی عبور کنید');
          await expect(page.locator('.carousel-next')).toBeEnabled();
          await page.locator('.carousel-next').click();
        }
        await expect(page.locator('.instruction-text2')).toContainText('رسیدن به');
        await expect(page.locator('.instruction-text2')).toContainText(destination.name);
        await expect(page.locator('.carousel-next')).toBeDisabled();
        await expect(page.locator('.step-counter')).toContainText(scenario.direct ? 'مرحله ۱ از ۱' : 'مرحله ۲ از ۲');
        if (!scenario.finalDoor) {
          await expect(page.locator('.distance-value')).not.toContainText(/^۰\s/);
        }
        if (!scenario.direct) {
          await page.locator('.carousel-prev').click();
          await expect(page.locator('.instruction-text2')).toContainText('از درگاه آزمایشی عبور کنید');
          await expect(page.locator('.carousel-next')).toBeEnabled();
        }
        expect(errors).toEqual([]);
      });
    }
  });
}
