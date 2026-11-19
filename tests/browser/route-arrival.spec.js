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

test.describe('RNG arrival guidance image', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

  for (const multifloor of [false, true]) {
    for (const result of ['image', 'no match', 'API error', 'image error']) {
      const floors = multifloor ? 'multifloor' : 'same-floor';
      test(`RNG shows the ${floors} arrival with guidance image result ${result}`, async ({ page, baseURL }) => {
        const hostname = new URL(baseURL).hostname;
        await page.route(url => ![hostname, 'localhost', '127.0.0.1'].includes(url.hostname), route => route.abort());
        const errors = await setupRoute(page, { multifloor, stored: true, arrivalM: 1 });
        const requests = [];
        const noMatch = { status: 'NO_MATCH', source: 'guidance_points', image: null };
        const imagePath = '/storage/rng-guidance-preview.svg';
        let finishRequest;
        const pending = new Promise(resolve => { finishRequest = resolve; });
        await page.route('**/api/v1/landmark-view-image?*', async route => {
          const params = new URL(route.request().url()).searchParams;
          const atDestination = Math.abs(Number(params.get('geo[lng]')) - destination.coordinates[1]) < 1e-7;
          requests.push({ atDestination, floor: Number(params.get('floor')), source: params.get('source') });
          if (!atDestination) return route.fulfill({ json: noMatch });
          await pending;
          if (result === 'API error') return route.fulfill({ status: 503, json: { status: 'ERROR' } });
          return route.fulfill({ json: result === 'no match' ? noMatch : {
            status: 'OK', source: 'guidance_points', image: { url: imagePath }
          } });
        });
        await page.route(`**${imagePath}`, route => result === 'image error'
          ? route.fulfill({ status: 404 })
          : route.fulfill({ contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="green"/></svg>' }));

        const icon = page.locator('.direction-icon-rng');
        const screen = page.locator('.routing-page');
        const status = page.locator('.image-placeholder-text');
        const arrivalRequests = () => requests.filter(request => request.atDestination);
        try {
          await page.goto('/#/rng');
          await expect.poll(() => requests.length).toBeGreaterThan(0);
          for (let index = 1; index <= (multifloor ? 3 : 1); index++) {
            await icon.click();
            await expect(screen).toHaveAttribute('data-current-step', String(index));
          }
          await expect.poll(() => arrivalRequests().length).toBe(1);
          expect(arrivalRequests()[0]).toEqual({ atDestination: true, floor: 0, source: 'guidance_points' });
          await expect(status).toHaveText('در حال دریافت تصویر راهنما…');
        } finally {
          finishRequest();
        }

        const image = page.getByRole('img', { name: 'تصویر راهنما', exact: true });
        if (result === 'image') {
          await expect(image).toBeVisible();
          expect(await image.evaluate(element => element.naturalWidth)).toBe(16);
          await expect(status).toHaveCount(0);
        } else {
          await expect(status).toHaveText(result === 'no match'
            ? 'برای این گام تصویر راهنما موجود نیست.' : 'دریافت تصویر راهنما ممکن نشد.');
          await expect(image).toHaveCount(0);
        }
        // Stay on the destination longer than the live refresh interval.
        await page.waitForTimeout(1800);
        expect(arrivalRequests()).toHaveLength(1);

        const requestCount = requests.length;
        await icon.click();
        await expect(screen).toHaveAttribute('data-current-step', '0');
        await expect.poll(() => requests.length).toBeGreaterThan(requestCount);
        expect(requests.at(-1)).toMatchObject({ atDestination: false, floor: multifloor ? -1 : 0 });
        await expect(status).toHaveText('برای این گام تصویر راهنما موجود نیست.');
        expect(errors).toEqual([]);
      });
    }
  }
});

test.describe('RNG live guidance image recovery', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

  for (const multifloor of [false, true]) {
    const floors = multifloor ? 'multifloor' : 'same-floor';
    test(`RNG live guidance image recovery retries the same URL on a ${floors} route`, async ({ page, baseURL }) => {
      const hostname = new URL(baseURL).hostname;
      await page.route(url => ![hostname, 'localhost', '127.0.0.1'].includes(url.hostname), route => route.abort());
      const errors = await setupRoute(page, { multifloor, stored: true, arrivalM: 1 });
      await page.addInitScript(() => sessionStorage.setItem('rngQrCorrectionHintSeen', '1'));
      const screen = page.locator('.routing-page');
      const currentStep = multifloor ? '2' : '0';
      const imagePath = '/storage/rng-live-guidance-recovery.svg';
      let lookupCount = 0;
      let fileAvailable = false;
      const downloads = [];
      await page.route('**/api/v1/landmark-view-image?*', async route => {
        const [mode, step] = await screen.evaluate(el => [el.dataset.navigationMode, el.dataset.currentStep]);
        if (mode !== 'live' || step !== currentStep) {
          return route.fulfill({ json: { status: 'NO_MATCH', source: 'guidance_points', image: null } });
        }
        lookupCount++;
        return route.fulfill({ json: { status: 'OK', source: 'guidance_points', image: { url: imagePath } } });
      });
      await page.route(`**${imagePath}`, route => {
        downloads.push(route.request().url());
        return fileAvailable ? route.fulfill({ contentType: 'image/svg+xml',
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="green"/></svg>' })
          : multifloor ? route.fulfill({ contentType: 'image/svg+xml', body: 'invalid image' })
            : route.fulfill({ status: 503 });
      });

      await page.goto('/#/rng');
      await page.locator('.start-routing-button').click();
      await expect(screen).toHaveAttribute('data-navigation-mode', 'live');
      if (multifloor) {
        await page.locator('.direction-icon-rng').click();
        await page.getByRole('button', { name: 'تأیید رسیدن به طبقه مقصد', exact: true }).click();
      }
      await expect(screen).toHaveAttribute('data-current-step', currentStep);
      const status = page.locator('.image-placeholder-text');
      await expect(status).toHaveText('دریافت تصویر راهنما ممکن نشد.');
      fileAvailable = true;
      const image = page.getByRole('img', { name: 'تصویر راهنما', exact: true });
      await expect(image).toBeVisible({ timeout: 12000 });
      expect(await image.evaluate(element => element.naturalWidth)).toBe(16);
      expect(downloads.length).toBeGreaterThanOrEqual(2);
      expect(new Set(downloads).size).toBe(1);
      await expect(status).toHaveCount(0);
      await expect(screen).toHaveAttribute('data-current-step', currentStep);
      await expect(screen).toHaveAttribute('data-navigation-mode', 'live');

      const recoveredDownloads = downloads.length;
      const recoveredLookups = lookupCount;
      await expect.poll(() => lookupCount).toBeGreaterThan(recoveredLookups);
      await expect(image).toBeVisible();
      expect(downloads).toHaveLength(recoveredDownloads);
      expect(errors).toEqual([]);
    });
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
