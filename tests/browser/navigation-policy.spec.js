import { test, expect } from '@playwright/test';
import { DEFAULT_NAVIGATION_POLICY } from '../../src/services/navigationPolicy.js';

async function setup(page, length = 40) {
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
    window.walkCycle = () => {
      const heading = new Event('deviceorientationabsolute');
      Object.assign(heading, { alpha: 0, absolute: true }); window.dispatchEvent(heading);
      for (const z of [9.8, 9.8, 10.5, 12.4, 13, 11, 9.6, 9.2, 9.7, 9.8, 9.8, 9.8]) {
        const motion = new Event('devicemotion');
        Object.defineProperty(motion, 'timeStamp', { value: window.motionTime });
        Object.assign(motion, { accelerationIncludingGravity: { x: 0, y: 0, z }, acceleration: null });
        window.motionTime += 50; window.dispatchEvent(motion);
      }
    };
  }, length);
  await page.route('**/api/v1/**', route => route.fulfill({ json: { status: 'NO_MATCH', data: [], features: [] } }));
  await page.route('**/api/v1/navigation-settings', route => route.fulfill({ json: { policy: DEFAULT_NAVIGATION_POLICY, version: 1, walk_speed_mps: 1.2 } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/rng');
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

test('excess uncertainty keeps QR available and a persistent warning in both panel states', async ({ page }) => {
  await setup(page, 100);
  await walk(page, 85);
  const warning = page.getByTestId('navigation-warning');
  await expect(warning).toContainText('حد خطا 20 متر');
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  const step = await page.locator('.routing-page').getAttribute('data-current-step');
  await walk(page, 8);
  await expect(page.locator('.routing-page')).toHaveAttribute('data-current-step', step);
  for (let i = 0; i < 2; i++) {
    await expect(warning).toBeVisible();
    await expect(page.getByRole('button', { name: 'اصلاح مسیر با QR' })).toBeVisible();
    const box = await warning.boundingBox();
    for (const control of [page.getByRole('button', { name: 'اصلاح مسیر با QR' }), page.getByRole('button', { name: 'توقف موقت', exact: true })]) {
      const action = await control.boundingBox();
      expect(box.y + box.height <= action.y || action.y + action.height <= box.y).toBe(true);
    }
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(360);
    await page.screenshot({ path: `test-results/navigation-warning-${i}.png` });
    if (i === 0) await page.locator('.expand-button').click();
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

async function openAdminPanel(page, roles) {
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
  });
  await page.route('**/api/v1/**', route => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/admin/navigation-settings')) return route.fallback();
    if (pathname.endsWith('/floors')) return route.fulfill({ json: [{ floor: 0, label: 'همکف' }] });
    const json = pathname.endsWith('/admin/auth/me')
      ? { id: 1, roles, permissions: [] }
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

  const accountMenu = await openAdminPanel(page, ['super_dashboard_admin']);
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

test('reports administrators cannot open navigation settings from the account menu', async ({ page }) => {
  let settingsRequests = 0;
  await page.route('**/api/v1/admin/navigation-settings', route => {
    settingsRequests++;
    return route.fulfill({ status: 403 });
  });
  const accountMenu = await openAdminPanel(page, ['manage_reports']);
  await expect(accountMenu.getByRole('button', { name: 'تنظیمات', exact: true })).toHaveCount(0);
  await expect(page.locator('.settings-modal-container')).toHaveCount(0);
  expect(settingsRequests).toBe(0);
});
