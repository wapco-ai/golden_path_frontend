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

test('administrator can edit and save policy in the existing settings form', async ({ page }) => {
  await setup(page);
  let saved = null;
  await page.route('**/api/v1/admin/navigation-settings', async route => {
    if (route.request().method() === 'PUT') saved = route.request().postDataJSON();
    await route.fulfill({ json: saved ? { ...saved, version: 2 } : { policy: DEFAULT_NAVIGATION_POLICY, version: 1, walk_speed_mps: 1.2 } });
  });
  await page.evaluate(async () => {
    const [{ default: React }, { default: ReactDOM }, { default: Settings }] = await Promise.all([
      import('/node_modules/.vite/deps/react.js'), import('/node_modules/.vite/deps/react-dom_client.js'),
      import('/src/AdminPanel/NavigationSettings.jsx')]);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;background:white;z-index:99999;padding:15px';
    document.body.appendChild(container);
    ReactDOM.createRoot(container).render(React.createElement(Settings, { adminFetch: (url, options) => fetch(url, options), onClose() {} }));
  });
  await page.getByLabel('حد هشدار خطای تجمعی (متر)', { exact: true }).fill('25');
  await page.getByRole('button', { name: 'ذخیره', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('ذخیره شد');
  expect(saved.policy.warning_uncertainty_m).toBe(25);
  expect(saved.policy.gps_enabled).toBe(false);
});
