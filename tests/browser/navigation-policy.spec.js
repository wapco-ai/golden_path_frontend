import { test, expect } from '@playwright/test';
import { DEFAULT_NAVIGATION_POLICY } from '../../src/services/navigationPolicy.js';

async function setup(page, length = 40, observeMap = false) {
  await page.clock.install();
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addInitScript(length => {
    const coordinates = [[59.615, 36.287], [59.615, 36.287 + length / 2 / 111195], [59.615, 36.287 + length / 111195]];
    const state = { origin: { name: 'مبدأ', coordinates: [36.287, 59.615], floor: 0 },
      destination: { name: 'مقصد', coordinates: [coordinates[2][1], 59.615], floor: 0 },
      routeGeo: { type: 'Feature', geometry: { type: 'LineString', coordinates },
        properties: { floor: 0, distanceMeters: length, durationSeconds: length } },
      routeSteps: coordinates.map(([lon, lat], i) => ({ type: i === 0 ? 'stepStart' : i === 2 ? 'stepArriveDestination' : 'stepGoStraight',
        routeM: i / 2, coord: { lon, lat }, instruction: `مرحله ${i + 1}` })),
      alternativeRoutes: [], transportMode: 'walk', gender: 'female' };
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
    for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('haramCurrentFloor', '0');
    sessionStorage.setItem('rngQrCorrectionHintSeen', '1');
    window.gpsCalls = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition() { window.gpsCalls++; }, watchPosition() { window.gpsCalls++; return 1; }, clearWatch() {}
    } });
    window.DeviceMotionEvent = class extends Event {};
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
  }, length);
  await page.route('**/api/v1/**', route => route.fulfill({ json: { status: 'NO_MATCH', data: [], features: [] } }));
  await page.route('**/api/v1/navigation-settings', route => route.fulfill({ json: { policy: DEFAULT_NAVIGATION_POLICY, version: 1, walk_speed_mps: 1.2 } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  if (observeMap) {
    await page.goto('/#/');
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
    await page.goto('/#/rng');
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
  expect(await page.evaluate(() => window.gpsCalls)).toBe(0);
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
