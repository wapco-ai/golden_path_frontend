import { test, expect } from '@playwright/test';

const origin = { name: 'مبدأ', floor: 0, coordinates: [36.287, 59.615] };
const destination = { name: 'مقصد', floor: 0, coordinates: [36.289, 59.615], door: { accessId: 42, selectedAreaId: 24 } };
const coords = [[59.615, 36.287], [59.615, 36.288], [59.615, 36.289]];
const routeGeo = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords },
  properties: { floor: 0, distanceMeters: 222, durationSeconds: 222 } };
const routeSteps = coords.map(([lon, lat], i) => ({ type: i === 2 ? 'stepArriveDestination' : 'stepStart',
  routeM: i / 2, coord: { lon, lat }, instruction: `راهنمای مرحله ${i + 1}` }));

async function setup(page, { audio = true } = {}) {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addInitScript(({ origin, destination, routeGeo, routeSteps, audio }) => {
    if (!sessionStorage.getItem('pauseTestSeeded')) {
      const state = { origin, destination, routeGeo, routeSteps, alternativeRoutes: [], transportMode: 'wheelchair', gender: 'female' };
      localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
      for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, JSON.stringify(value));
      sessionStorage.setItem('pauseTestSeeded', '1');
      sessionStorage.setItem('haramCurrentFloor', '0');
      sessionStorage.setItem('rngQrCorrectionHintSeen', '1');
    }
    window.audioPlays = 0;
    window.audioPauses = 0;
    if (audio) {
      HTMLMediaElement.prototype.play = function () { window.audioPlays++; return Promise.resolve(); };
      HTMLMediaElement.prototype.pause = function () { window.audioPauses++; };
    }
    window.gpsFix = { lat: 36.287, lng: 59.615 };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (success, error) => {
        window.resumeGps = success;
        if (window.gpsPending) return;
        if (!window.gpsFix) return error({ code: 1 });
        success({ timestamp: Date.now() - (window.gpsAge || 0), coords: {
          latitude: window.gpsFix.lat, longitude: window.gpsFix.lng, accuracy: window.gpsAccuracy ?? 5 } });
      },
      watchPosition: success => { window.sendGps = (lat, lng) => success({ timestamp: Date.now(),
        coords: { latitude: lat, longitude: lng, accuracy: 5 } }); return 1; }, clearWatch() {}
    } });
  }, { origin, destination, routeGeo, routeSteps, audio });
  await page.route('**/api/v1/**', route => route.fulfill({ json: { status: 'NO_MATCH', data: [], features: [] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/');
  // Replace the external speech provider, while exercising actual playback lifecycle.
  await page.evaluate(async () => {
    const { default: tts } = await import('/src/services/ttsService.js');
    tts.fetchSpeech = () => new Promise(resolve => {
      window.finishSpeech = () => resolve(new Blob(['test'], { type: 'audio/wav' }));
      if (!window.speechPending) window.finishSpeech();
    });
  });
  await page.goto('/#/rng');
  await expect(page.locator('.instruction-text')).toBeVisible();
  await expect(page.locator('.rng-pause-button')).toHaveCount(0);
  await page.locator('.start-routing-button').click();
  await expect(page.getByRole('button', { name: 'توقف موقت', exact: true })).toBeVisible();
}

const pause = page => page.getByRole('button', { name: 'توقف موقت', exact: true });
const resume = page => page.getByRole('button', { name: 'ادامه مسیر', exact: true });
const state = page => page.locator('.routing-page');

test('pause freezes progress and audio through GPS movement, visibility changes and page reload', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.sendGps(36.2873, 59.615));
  await expect.poll(() => page.evaluate(() => window.audioPlays)).toBeGreaterThan(0);
  await pause(page).click();
  await expect(state(page)).toHaveAttribute('data-navigation-mode', 'paused');
  const index = await state(page).getAttribute('data-current-step');
  const plays = await page.evaluate(() => window.audioPlays);
  await page.evaluate(() => {
    window.sendGps(36.289, 59.615);
    document.querySelector('.direction-icon-rng').click();
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1200);
  await expect(state(page)).toHaveAttribute('data-current-step', index);
  await expect(state(page)).toHaveAttribute('data-navigation-mode', 'paused');
  expect(await page.evaluate(() => window.audioPlays)).toBe(plays);
  await page.reload();
  await expect(resume(page)).toBeVisible();
  await expect(state(page)).toHaveAttribute('data-current-step', index);
  await page.evaluate(() => { window.gpsFix = { lat: 36.2884, lng: 59.615 }; });
  await resume(page).click();
  await expect(state(page)).toHaveAttribute('data-navigation-mode', 'live');
  await expect(state(page)).toHaveAttribute('data-current-step', '1');
  await pause(page).click();
  await expect(state(page)).toHaveAttribute('data-navigation-mode', 'paused');
});

test('both controls have identical appearance and stay aligned in open and collapsed panels', async ({ page }, testInfo) => {
  await setup(page);
  for (const panelState of ['closed', 'open']) {
    await expect(page.locator('.info-modal')).toHaveClass(new RegExp(panelState));
    await expect.poll(() => page.evaluate(() => {
      const stop = document.querySelector('.rng-pause-button');
      const qr = document.querySelector('.rng-map-actions:not(.rng-pause-actions) button');
      const a = stop.getBoundingClientRect(), b = qr.getBoundingClientRect();
      const keys = ['width', 'height', 'borderRadius', 'backgroundColor', 'color', 'boxShadow', 'padding', 'border'];
      return a.width === 52 && a.height === 52 && a.x === 16 && b.right === 344 && a.y === b.y
        && keys.every(key => getComputedStyle(stop)[key] === getComputedStyle(qr)[key]);
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`active-${panelState}.png`) });
    if (panelState === 'closed') await page.locator('.expand-button').click();
  }
  await pause(page).click();
  await page.screenshot({ path: testInfo.outputPath('paused-open.png') });
});

test('missing, stale and imprecise GPS keep navigation paused and QR available', async ({ page }) => {
  await setup(page);
  await pause(page).click();
  for (const bad of ['missing', 'stale', 'imprecise']) {
    await page.evaluate(bad => {
      window.gpsFix = bad === 'missing' ? null : { lat: 36.288, lng: 59.615 };
      window.gpsAge = bad === 'stale' ? 60000 : 0;
      window.gpsAccuracy = bad === 'imprecise' ? 90 : 5;
    }, bad);
    await resume(page).click();
    await expect(resume(page)).toBeEnabled();
    await expect(state(page)).toHaveAttribute('data-navigation-mode', 'paused');
    await expect(page.getByRole('button', { name: 'اصلاح مسیر با QR' })).toBeVisible();
  }
});

test('resuming away from the route recalculates to the same door and retains travel preferences', async ({ page }) => {
  await setup(page);
  await pause(page).click();
  await page.evaluate(() => { window.gpsFix = { lat: 36.2875, lng: 59.617 }; });
  const newCoords = [[59.617, 36.2875], [59.616, 36.288], coords[2]];
  await page.route('**/api/v1/routing/route', route => route.fulfill({ json: {
    geo: { ...routeGeo, geometry: { type: 'LineString', coordinates: newCoords } },
    steps: newCoords.map(([lon, lat], i) => ({ type: i === 2 ? 'stepArriveDestination' : 'stepStart',
      coord: { lon, lat }, routeM: i / 2, instruction: i === 2 ? 'رسیدن به مقصد' : 'ادامه از موقعیت تازه' }))
  } }));
  const request = page.waitForRequest('**/api/v1/routing/route');
  await resume(page).click();
  expect((await request).postDataJSON()).toMatchObject({ mode: 'wheelchair', gender: 'female',
    origin: { lat: 36.2875, lon: 59.617, floor: 0 },
    destination: { type: 'door', accessId: 42, areaId: 24, floor: 0 } });
  await expect(state(page)).toHaveAttribute('data-navigation-mode', 'live');
  await expect(page.locator('.instruction-text')).toContainText('ادامه از موقعیت تازه');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('destination')))).toEqual(destination);
});

test('failed recalculation retains the route and a delayed GPS response cannot restart an ended trip', async ({ page }) => {
  await setup(page);
  await pause(page).click();
  await page.evaluate(() => { window.gpsFix = { lat: 36.2875, lng: 59.617 }; });
  await page.route('**/api/v1/routing/route', route => route.fulfill({ status: 422, json: {} }));
  await resume(page).click();
  await expect(resume(page)).toBeEnabled();
  await expect(state(page)).toHaveAttribute('data-navigation-mode', 'paused');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('routeGeo')))).toEqual(routeGeo);
  await page.evaluate(() => { window.gpsPending = true; });
  await resume(page).click();
  await expect(resume(page)).toBeDisabled();
  await page.locator('.expand-button').click();
  await page.locator('.start-routing-button').click();
  await page.evaluate(() => window.resumeGps({ timestamp: Date.now(), coords: {
    latitude: 36.288, longitude: 59.615, accuracy: 5 } }));
  await expect(state(page)).toHaveAttribute('data-navigation-mode', 'preview');
  expect(await page.evaluate(() => sessionStorage.getItem('rngPausedNavigation'))).toBeNull();
});

test('pending speech cannot play after pause, and resume speaks the current instruction', async ({ page }) => {
  await setup(page);
  await pause(page).click();
  await page.evaluate(() => { window.speechPending = true; });
  await resume(page).click();
  await expect(state(page)).toHaveAttribute('data-navigation-mode', 'live');
  await pause(page).click();
  const plays = await page.evaluate(() => window.audioPlays);
  await page.evaluate(() => window.finishSpeech());
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.audioPlays)).toBe(plays);
  await page.evaluate(() => { window.speechPending = false; });
  await resume(page).click();
  await expect.poll(() => page.evaluate(() => window.audioPlays)).toBeGreaterThan(plays);
});
