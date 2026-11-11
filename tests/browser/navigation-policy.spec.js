import { test, expect } from '@playwright/test';
import { DEFAULT_NAVIGATION_POLICY } from '../../src/services/navigationPolicy.js';

async function setup(page, length = 40, observeMap = false, stepTest = false) {
  await page.clock.install();
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addInitScript(({ length, stepTest }) => {
    const middle = stepTest ? 0.15 : 0.5;
    const coordinates = [[59.615, 36.287], [59.615, 36.287 + length * middle / 111195], [59.615, 36.287 + length / 111195]];
    const state = { origin: { name: 'مبدأ', coordinates: [36.287, 59.615], floor: 0 },
      destination: { name: 'مقصد', coordinates: [coordinates[2][1], 59.615], floor: 0 },
      routeGeo: { type: 'Feature', geometry: { type: 'LineString', coordinates },
        properties: { floor: 0, distanceMeters: length, durationSeconds: length } },
      routeSteps: coordinates.map(([lon, lat], i) => ({ type: i === 0 ? 'stepStart' : i === 2 ? 'stepArriveDestination' : 'stepGoStraight',
        routeM: [0, middle, 1][i], coord: { lon, lat }, instruction: `مرحله ${i + 1}` })),
      alternativeRoutes: [], transportMode: 'walk', gender: 'female' };
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
    for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('haramCurrentFloor', '0');
    sessionStorage.setItem('rngQrCorrectionHintSeen', '1');
    window.gpsCalls = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition() { window.gpsCalls++; }, watchPosition() { window.gpsCalls++; return 1; }, clearWatch() {}
    } });
    window.motionPermissionRequests = 0;
    window.DeviceMotionEvent = class extends Event {
      static requestPermission() {
        window.motionPermissionRequests++;
        return Promise.resolve('granted');
      }
    };
    window.DeviceOrientationEvent = class extends Event {};
    window.motionTime = 1000;
    window.compass = bearing => {
      const heading = new Event('deviceorientationabsolute');
      Object.assign(heading, { alpha: (360 - bearing) % 360, absolute: true });
      window.dispatchEvent(heading);
    };
    window.walkCycle = (withHeading = true, paced = false, idle = false) => {
      if (withHeading) window.compass(0);
      const emitMotion = z => {
        const motion = new Event('devicemotion');
        Object.defineProperty(motion, 'timeStamp', { value: window.motionTime });
        Object.assign(motion, { accelerationIncludingGravity: { x: 0, y: 0, z }, acceleration: null,
          rotationRate: { alpha: 0, beta: 0, gamma: 0 } });
        window.motionTime += 50;
        window.dispatchEvent(motion);
      };
      [9.8, 9.8, 10.5, 12.4, 13, 11, 9.6, 9.2, 9.7, 9.8, 9.8, 9.8].forEach((z, i) => {
        const acceleration = idle ? 9.8 : z;
        if (paced) setTimeout(() => emitMotion(acceleration), i * 50);
        else emitMotion(acceleration);
      });
    };
  }, { length, stepTest });
  await page.route('**/api/v1/**', route => route.fulfill({ json: { status: 'NO_MATCH', data: [], features: [] } }));
  await page.route('**/api/v1/navigation-settings', route => route.fulfill({ json: { policy: DEFAULT_NAVIGATION_POLICY, version: 1, walk_speed_mps: 1.2 } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  if (observeMap) {
    await page.goto(stepTest ? '/?step-test=1#/' : '/#/');
    await page.evaluate(async () => {
      const source = await (await fetch('/src/components/map/RouteMap.jsx')).text();
      const modulePath = source.match(/["']([^"']*\/maplibre-gl\.js\?[^"']+)["']/)?.[1];
      const { default: maplibre } = await import(modulePath);
      const easeTo = maplibre.Map.prototype.easeTo;
      maplibre.Map.prototype.easeTo = function (...args) {
        window.rngMap = this;
        return easeTo.apply(this, args);
      };
    });
    await page.evaluate(() => { window.location.hash = '#/rng'; });
  } else {
    await page.goto(stepTest ? '/?step-test=1#/rng' : '/#/rng');
  }
  await page.locator('.start-routing-button').click();
  await expect(page.getByRole('button', { name: 'توقف موقت', exact: true })).toBeVisible();
}
async function walk(page, count) {
  for (let i = 0; i < count; i++) {
    await page.clock.fastForward(600);
    await page.evaluate(() => window.walkCycle());
    await page.clock.runFor(20);
  }
}

test('Haram default ignores GPS and reaches the destination using actual motion events without scanning', async ({ page }) => {
  await setup(page);
  await walk(page, 58);
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'arrived');
  await expect(page.locator('.instruction-text')).toHaveText('به مقصد رسیدید.');
  await expect(page.getByTestId('step-diagnostics')).toHaveCount(0);
  expect(await page.evaluate(() => window.gpsCalls)).toBe(0);
});

test('the home map shows the requested device location without enabling GPS for routing', async ({ page, context }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await context.grantPermissions(['geolocation']);
  await page.addInitScript(() => {
    sessionStorage.setItem('selectedMapType', 'base');
    window.gpsCalls = [];
    const geolocation = navigator.geolocation;
    for (const method of ['getCurrentPosition', 'watchPosition', 'clearWatch']) {
      const original = geolocation[method].bind(geolocation);
      geolocation[method] = (...args) => {
        window.gpsCalls.push(method);
        return original(...args);
      };
    }
  });
  const landmarkRequests = [];
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/navigation-settings')) {
      return route.fulfill({ json: { policy: DEFAULT_NAVIGATION_POLICY } });
    }
    if (url.pathname.endsWith('/qrcodes/invalid-qr')) {
      return route.fulfill({ status: 404, json: {} });
    }
    if (url.pathname.endsWith('/qrcodes/verified-qr')) {
      await new Promise(resolve => setTimeout(resolve, 5500));
      return route.fulfill({ json: { id: 'verified-qr', coordinates: [36.287, 59.615], floor: -1, title: 'QR' } });
    }
    if (url.pathname.endsWith('/landmark-places')) {
      landmarkRequests.push(url.searchParams);
      return route.fulfill({ json: { places: { landmarkPlaces: [] } } });
    }
    return route.fulfill({ json: { data: [], features: [] } });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }]
  } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));

  await page.goto('/#/mpb');
  const locate = page.locator('.map-gps-button');
  const marker = page.locator('.map-marker-origin');
  const canvas = page.locator('.maplibregl-canvas');
  await expect(locate).toBeVisible();
  await expect(canvas).toBeVisible();
  expect(await page.evaluate(() => window.gpsCalls)).toEqual([]);
  await expect(marker).toHaveCount(0);

  await context.setGeolocation({ latitude: 36.289, longitude: 59.617, accuracy: 12 });
  await locate.click();
  await expect(marker).toBeVisible();
  expect(await page.evaluate(() => window.gpsCalls)).toEqual(['getCurrentPosition', 'watchPosition']);
  expect(landmarkRequests.length).toBeGreaterThan(0);
  expect(landmarkRequests.every(params => !params.has('geo[lat]') && !params.has('geo[lng]'))).toBe(true);

  const markerX = async () => (await marker.boundingBox()).x;
  const centeredX = await markerX();
  const mapBounds = await canvas.boundingBox();
  const x = mapBounds.x + 105;
  const y = mapBounds.y + 145;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 65, y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(markerX).toBeGreaterThan(centeredX + 25);
  await page.mouse.move(x + 65, y);
  await page.mouse.wheel(0, 180);
  await expect(locate).toHaveClass(/\bactive\b/);
  await expect(marker).toBeVisible();
  await expect.poll(markerX).toBeGreaterThan(centeredX + 25);
  expect(await page.evaluate(() => window.gpsCalls)).toEqual(['getCurrentPosition', 'watchPosition']);
  const afterPan = await markerX();
  await context.setGeolocation({ latitude: 36.289, longitude: 59.6171, accuracy: 12 });
  await expect.poll(markerX).toBeGreaterThan(afterPan + 2);

  await locate.click();
  await expect(marker).toHaveCount(0);
  expect(await page.evaluate(() => window.gpsCalls.at(-1))).toBe('clearWatch');

  await context.setGeolocation({ latitude: 36.289, longitude: 59.6171, accuracy: 12 });
  await locate.click();
  await expect(marker).toBeVisible();
  const qrLink = id => page.evaluate(code => { window.location.hash = '#/location?lat=1&lng=2&id=' + code; }, id);
  const invalidLookup = page.waitForResponse('**/qrcodes/invalid-qr?**');
  await qrLink('invalid-qr');
  await invalidLookup;
  await expect(page).toHaveURL(/#\/mpb$/);
  await expect(marker).toBeVisible();
  expect(await page.evaluate(() => window.gpsCalls.at(-1))).toBe('watchPosition');

  let finishLookup;
  const pendingLookup = new Promise(resolve => { finishLookup = resolve; });
  await page.route('**/qrcodes/cancelled-qr?**', async route => {
    await pendingLookup;
    await route.fulfill({ json: { id: 'cancelled-qr', coordinates: [36.288, 59.616], floor: 0 } }).catch(() => {});
  });
  try {
    const lookupStarted = page.waitForRequest('**/qrcodes/cancelled-qr?**');
    await qrLink('cancelled-qr');
    await lookupStarted;
    await expect(marker).toBeVisible();
    await page.evaluate(() => { window.location.hash = '#/mpb'; });
    await expect(page).toHaveURL(/#\/mpb$/);
  } finally {
    finishLookup();
  }
  await expect(marker).toBeVisible();
  expect(await page.evaluate(() => window.gpsCalls.at(-1))).toBe('watchPosition');

  await qrLink('verified-qr');
  await expect(locate).toHaveCount(0, { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.gpsCalls.at(-1))).toBe('clearWatch');
  expect(await page.evaluate(() => ['qrLat', 'qrLng', 'qrFloor'].map(key => sessionStorage.getItem(key))))
    .toEqual(['36.287', '59.615', '-1']);
  await page.evaluate(() => { window.location.hash = '#/mpb'; });
  await expect(marker).toBeVisible();
  await expect(locate).toHaveClass(/\binactive\b/);
});

test('step-test counts sensor steps and distinguishes the final instruction from arrival', async ({ page }) => {
  await setup(page, 40, false, true);
  await expect(page.getByTestId('step-diagnostic-steps')).toHaveText('0');
  await walk(page, 2);
  const routing = page.locator('.routing-page');
  await expect(routing).toHaveAttribute('data-current-step', '1');
  await expect(routing).toHaveAttribute('data-navigation-mode', 'live');
  await expect(page.locator('.instruction-text')).toHaveText('به مسیر تا مقصد ادامه دهید.');
  await expect(page.getByTestId('step-diagnostic-samples')).toHaveText('24');
  await expect(page.getByTestId('step-diagnostic-steps')).toHaveText('2');
  await expect(page.getByTestId('step-diagnostic-distance')).toHaveText('1.4');
  await expect(page.getByTestId('step-diagnostic-progress')).toHaveText('1.4');
  await expect(page.getByTestId('step-diagnostic-state')).toHaveText('فعال · 2');
});

test('live map rotates without steps and manual-origin walking advances after a sparse compass update', async ({ page }) => {
  await setup(page, 40, true);
  const mapFrame = () => page.evaluate(() => {
    const map = window.rngMap;
    if (!map) return null;
    return {
      bearing: map.getBearing(),
      moving: map.isMoving(),
      latitude: map.getCenter().lat,
      remainingStart: map.getSource('remaining-route')?.serialize().data?.geometry?.coordinates?.[0]?.[1],
    };
  });
  await page.evaluate(() => window.walkCycle(false, true, true));
  await page.clock.runFor(650);
  await expect.poll(async () => (await mapFrame())?.moving, { timeout: 20000 }).toBe(false);
  const initial = await mapFrame();
  await page.evaluate(() => {
    window.compass(45);
    window.walkCycle(false, true, true);
  });
  await page.clock.runFor(650);
  const turned = await mapFrame();
  expect(turned.bearing).toBeCloseTo(45, 1);
  expect(turned.latitude).toBeCloseTo(initial.latitude, 7);

  await page.evaluate(() => {
    window.compass(0);
    for (let i = 0; i < 15; i++) {
      setTimeout(() => window.walkCycle(false, true), i * 600);
    }
  });
  await page.clock.runFor(9350);
  const walked = await mapFrame();
  // At least 9 m. The first five seconds alone can account for less than 6 m.
  expect(walked.latitude - initial.latitude).toBeGreaterThan(9 / 111195);
  expect(walked.remainingStart - initial.latitude).toBeGreaterThan(9 / 111195);
  expect(await page.evaluate(() => window.gpsCalls)).toBe(0);
});

test('excess uncertainty blocks arrival and keeps the map controls visible without a banner', async ({ page }) => {
  await setup(page, 64);
  await walk(page, 85);
  const state = page.locator('.routing-page');
  // 85 default 0.7 m steps add 17.85 m to the selected origin's 5 m allowance.
  await expect(state).toHaveAttribute('data-current-step', '1');
  // Walk into the arrival radius after crossing the configured 20 m uncertainty limit.
  await walk(page, 8);
  await expect(state).toHaveAttribute('data-navigation-mode', 'live');
  await expect(state).toHaveAttribute('data-current-step', '1');
  for (const panel of ['closed', 'open']) {
    await expect(page.locator(`.info-modal.${panel}`)).toBeVisible();
    await expect(page.getByTestId('navigation-warning')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'اصلاح مسیر با QR' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'توقف موقت', exact: true })).toBeVisible();
    if (panel === 'closed') await page.locator('.expand-button').click();
  }
  expect(await page.evaluate(() => window.gpsCalls)).toBe(0);
});

test('pause and confirmed resume preserve cumulative uncertainty without GPS', async ({ page }) => {
  await setup(page, 100);
  await walk(page, 20);
  const before = await page.evaluate(async () => (await import('/src/services/AdvancedDeadReckoningService.js')).default.positionAccuracy);
  await page.getByRole('button', { name: 'توقف موقت', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'ادامه مسیر', exact: true }).click();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  const after = await page.evaluate(async () => (await import('/src/services/AdvancedDeadReckoningService.js')).default.positionAccuracy);
  expect(after).toBe(before);
  await walk(page, 3);
  expect(await page.evaluate(() => window.gpsCalls)).toBe(0);
});

test('pause and resume keep the map position, accept late sensor data, and require real arrival', async ({ page }) => {
  await setup(page, 40, true, true);
  await walk(page, 10);
  const state = page.locator('.routing-page');
  const pause = page.getByRole('button', { name: 'توقف موقت', exact: true });
  const resume = page.getByRole('button', { name: 'ادامه مسیر', exact: true });
  const steps = page.getByTestId('step-diagnostic-steps');
  const progress = page.getByTestId('step-diagnostic-progress');
  const mapState = () => page.evaluate(() => {
    const map = window.rngMap;
    return {
      bearing: map.getBearing(),
      remainingStart: map.getSource('remaining-route').serialize().data.geometry.coordinates[0][1],
    };
  });
  await expect(steps).toHaveText('10');
  const before = await mapState();
  const progressBefore = await progress.innerText();
  await pause.click();
  await walk(page, 2);
  await expect(steps).toHaveText('10');
  expect(await mapState()).toEqual(before);

  page.once('dialog', dialog => dialog.accept());
  await resume.click();
  await page.clock.runFor(11000);
  await expect(progress).toHaveText(progressBefore);
  expect((await mapState()).remainingStart).toBeCloseTo(before.remainingStart, 8);

  await page.evaluate(() => window.compass(45));
  await page.clock.runFor(650);
  await expect.poll(async () => (await mapState()).bearing).toBeCloseTo(45, 1);
  await expect(steps).toHaveText('10');
  await walk(page, 1);
  await expect(steps).toHaveText('11');
  expect((await mapState()).remainingStart).toBeGreaterThan(before.remainingStart);
  await expect(state).toHaveAttribute('data-navigation-mode', 'live');
  await expect(page.locator('.instruction-text')).toHaveText('به مسیر تا مقصد ادامه دهید.');

  // Pause again after the first qualifying observation near the destination.
  await walk(page, 42);
  await expect(steps).toHaveText('53');
  await expect(state).toHaveAttribute('data-navigation-mode', 'live');
  await pause.click();
  page.once('dialog', dialog => dialog.accept());
  await resume.click();
  await walk(page, 1);
  await expect(state).toHaveAttribute('data-navigation-mode', 'live');
  await walk(page, 1);
  await expect(state).toHaveAttribute('data-navigation-mode', 'arrived');
  await expect(page.locator('.instruction-text')).toHaveText('به مقصد رسیدید.');
  expect(await page.evaluate(() => [window.gpsCalls, window.motionPermissionRequests])).toEqual([0, 1]);
});

async function openAdminPanel(page, profile) {
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
  });
  await page.route('**/api/v1/**', route => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/admin/navigation-settings')) return route.fallback();
    if (pathname.endsWith('/floors')) return route.fulfill({ json: [{ floor: 0, label: 'همکف' }] });
    const json = pathname.endsWith('/admin/auth/me')
      ? { id: 1, permissions: [], ...profile }
      : { data: [], total: 0 };
    return route.fulfill({ json });
  });
  await page.goto('/#/admin');
  const accountMenu = page.locator('.sidebar-footer');
  await expect(accountMenu.getByText('حساب کاربری', { exact: true })).toBeVisible();
  return accountMenu;
}

test('dashboard administrator opens settings from the account menu and saves the uncertainty limit', async ({ page }) => {
  let settings = { policy: DEFAULT_NAVIGATION_POLICY, version: 1, walk_speed_mps: 1.2 };
  let saved = null;
  await page.route('**/api/v1/admin/navigation-settings', async route => {
    const request = route.request();
    expect(request.headers().authorization).toBe('Bearer browser-fixture-only');
    if (request.method() === 'PUT') {
      saved = request.postDataJSON();
      settings = { ...saved, version: settings.version + 1 };
    }
    await route.fulfill({ json: settings });
  });

  const accountMenu = await openAdminPanel(page, {
    roles: ['super_dashboard_admin'], canManageNavigationSettings: true,
  });
  const settingsEntry = accountMenu.getByRole('button', { name: 'تنظیمات', exact: true });
  const form = page.locator('.settings-modal-container');
  await expect(form).toHaveCount(0);
  await settingsEntry.click();

  const limit = form.getByLabel('حد هشدار خطای تجمعی (متر)', { exact: true });
  await expect(limit).toHaveValue('20');
  await limit.fill('25');
  await form.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect(form.getByRole('status')).toContainText('ذخیره شد');
  expect(saved).toEqual({
    policy: { ...DEFAULT_NAVIGATION_POLICY, warning_uncertainty_m: 25 },
    version: 1,
    walk_speed_mps: 1.2,
  });

  await form.getByRole('button', { name: 'بستن', exact: true }).click();
  await expect(form).toHaveCount(0);
  await settingsEntry.click();
  await expect(limit).toHaveValue('25');
});

test('another dashboard administrator cannot open navigation settings from the account menu', async ({ page }) => {
  let settingsRequests = 0;
  await page.route('**/api/v1/admin/navigation-settings', route => {
    settingsRequests++;
    return route.fulfill({ status: 403 });
  });
  const accountMenu = await openAdminPanel(page, {
    roles: ['super_dashboard_admin'], canManageNavigationSettings: false,
  });
  await expect(accountMenu.getByRole('button', { name: 'تنظیمات', exact: true })).toHaveCount(0);
  await expect(page.locator('.settings-modal-container')).toHaveCount(0);
  expect(settingsRequests).toBe(0);
});
