import { test, expect } from '@playwright/test';
import { normalizeRouteSnapshot } from '../../src/services/routingService.js';

const coordinates = [[59.615, 36.287], [59.6151, 36.287], [59.6152, 36.287]];
const origin = { name: 'مبدأ', floor: 0, coordinates: [36.287, 59.615] };
const destination = { name: 'مقصد آزمایشی', floor: 0, coordinates: [36.287, 59.6152] };

function routeFixture({ arrivalM, finalDoor = false, direct = false }) {
  const steps = [
    { type: 'stepStart', title: 'شروع حرکت', coord: { lat: 36.287, lon: 59.615 }, routeM: 0, floor: 0, segmentId: 0 },
    ...(direct ? [] : [{ type: 'stepPassDoor', title: 'درگاه آزمایشی', instruction: 'از درگاه آزمایشی عبور کنید',
      coord: { lat: 36.287, lon: finalDoor ? 59.6152 : 59.6151 }, routeM: finalDoor ? 1 : 0.5,
      doorId: 7, floor: 0, segmentId: 0 }]),
    { type: 'stepArriveDestination', title: '', coord: { lat: 36.287, lon: 59.6152 },
      ...(arrivalM === undefined ? {} : { routeM: arrivalM }), floor: 0, segmentId: 0 }
  ];
  return { status: 'OK', multifloor: false, geo: { type: 'Feature',
    geometry: { type: 'LineString', coordinates }, properties: { multifloor: false } }, steps, alternatives: [] };
}

async function setupRoute(page, options) {
  const raw = routeFixture(options);
  const snapshot = normalizeRouteSnapshot(raw, origin, destination);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ origin, destination, snapshot, stored }) => {
    const state = { origin, destination, transportMode: 'walking', gender: 'both', alternativeRoutes: [],
      routeGeo: stored ? snapshot.geo : null, routeSteps: stored ? snapshot.steps : [] };
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
    sessionStorage.setItem('haramCurrentFloor', '0');
    if (stored) {
      sessionStorage.setItem('routeGeo', JSON.stringify(snapshot.geo));
      sessionStorage.setItem('routeSteps', JSON.stringify(snapshot.steps));
    }
  }, { origin, destination, snapshot, stored: options.stored });
  await page.route('**/api/v1/**', route => route.fulfill({ json: { status: 'NO_MATCH', data: [], features: [] } }));
  await page.route('**/api/v1/routing/route', route => route.fulfill({ json: raw }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  return errors;
}

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
