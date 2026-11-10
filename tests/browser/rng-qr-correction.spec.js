import { test as base, expect } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import QRCode from 'qrcode';

const code = 'QR-RAVAQ-QODS-02';
const origin = { name: 'مبدأ', floor: 0, coordinates: [36.287, 59.615] };
const destination = { name: 'مقصد', floor: 0, coordinates: [36.288, 59.616], door: { accessId: 42, selectedAreaId: 24 } };
const anchor = { id: code, floor: -1, coordinates: [36.2876, 59.6158], title: 'تابلوی رواق' };
const point = ({ coordinates: [lat, lng] }) => [lng, lat];
const line = coordinates => ({ type: 'LineString', coordinates });
const firstLine = line([point(origin), point(destination)]);
const step = (type, floor, segmentId, routeM, coordinates, extra = {}) => ({
  type, floor, segmentId, routeM, coord: { lon: coordinates[0], lat: coordinates[1] }, ...extra
});
const firstRoute = {
  geo: { type: 'Feature', geometry: firstLine, properties: { floor: 0, distanceMeters: 150, durationSeconds: 150 } },
  steps: [step('stepStart', 0, 0, 0, point(origin)), step('stepArriveDestination', 0, 0, 1, point(destination))]
};

const landing = [59.6159, 36.2878];
const basement = line([point(anchor), landing]);
const ground = line([landing, point(destination)]);
const correctedRoute = {
  geo: { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [basement.coordinates, ground.coordinates] },
    properties: { multifloor: true, distanceMeters: 60, durationSeconds: 90, segments: [
      { id: 0, kind: 'walk', floor: -1, geometry: basement, distance_m: 24, duration_s: 24 },
      { id: 1, kind: 'elevator', floor: -1, fromFloor: -1, toFloor: 0, geometry: null, distance_m: 0, duration_s: 36 },
      { id: 2, kind: 'walk', floor: 0, geometry: ground, distance_m: 36, duration_s: 30 }
    ] } },
  steps: [step('stepStart', -1, 0, 0, point(anchor), { instruction: 'حرکت از موقعیت جدید' }),
    step('stepChangeFloor', -1, 1, 0, landing, { fromFloor: -1, toFloor: 0, duration_s: 36, instruction: 'با آسانسور به همکف بروید.' }),
    step('stepStart', 0, 2, 0, landing), step('stepArriveDestination', 0, 2, 1, point(destination))]
};

const test = base.extend({
  launchOptions: [async ({ launchOptions }, use) => {
    const dir = await mkdtemp(join(tmpdir(), 'rng-qr-camera-'));
    const video = join(dir, 'qr.y4m');
    // The printed URL carries deliberately wrong coordinates and floor. Only the ID is trusted.
    const qr = QRCode.create(`https://example.org/#/location?lat=1&lng=2&floor=5&id=${code}`).modules;
    const size = 400;
    const scale = 8;
    const margin = Math.floor((size - qr.size * scale) / 2);
    const frame = Buffer.alloc(size * size * 1.5, 128);
    frame.fill(235, 0, size * size);
    for (let row = 0; row < qr.size; row++) {
      for (let col = 0; col < qr.size; col++) {
        if (!qr.get(row, col)) continue;
        for (let y = 0; y < scale; y++) {
          const start = (margin + row * scale + y) * size + margin + col * scale;
          frame.fill(16, start, start + scale);
        }
      }
    }
    await writeFile(video, Buffer.concat([Buffer.from(`YUV4MPEG2 W${size} H${size} F10:1 Ip A1:1 C420jpeg\nFRAME\n`), frame]));
    try {
      await use({ ...launchOptions, args: [...(launchOptions.args || []), '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, { scope: 'worker' }]
});

async function startRoute(page) {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addInitScript(({ origin, destination, firstRoute }) => {
    const state = { origin, destination, routeGeo: firstRoute.geo, routeSteps: firstRoute.steps,
      alternativeRoutes: [], transportMode: 'wheelchair', gender: 'female' };
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
    for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('haramCurrentFloor', '0');
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() {},
      watchPosition: callback => { window.sendGps = callback; return 1; }, clearWatch() {} } });
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.cameraTracks = [];
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await getUserMedia(constraints);
      window.cameraTracks.push(...stream.getTracks());
      return stream;
    };
  }, { origin, destination, firstRoute });
  await page.route('**/api/v1/**', route => route.fulfill({ json: { status: 'NO_MATCH', data: [], features: [] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/rng');
  const button = page.getByRole('button', { name: 'اصلاح مسیر با QR' });
  await expect(button).toHaveCount(0);
  await page.locator('.start-routing-button').click();
  await expect(button).toBeVisible();
  return button;
}

async function expectCameraReleased(page) {
  await expect.poll(() => page.evaluate(() => window.cameraTracks.length > 0
    && window.cameraTracks.every(track => track.readyState === 'ended'))).toBe(true);
}

test('RNG scans with GPS off, keeps the destination and updates the floor without stopping', async ({ page }) => {
  const button = await startRoute(page);
  for (const state of ['closed', 'open']) {
    const panel = page.locator(`.info-modal.${state}`);
    await expect(panel).toBeVisible();
    await expect.poll(async () => {
      const [action, sheet, map] = await Promise.all([button.boundingBox(), panel.boundingBox(), page.locator('.map-section').boundingBox()]);
      return action.width === 52 && action.height === 52 && action.x + action.width === 344
        && action.y >= map.y && action.y + action.height < sheet.y;
    }).toBe(true);
    if (state === 'closed') await page.locator('.expand-button').click();
  }
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ json: anchor }));
  await page.route('**/api/v1/routing/route', route => route.fulfill({ json: correctedRoute }));
  const request = page.waitForRequest('**/api/v1/routing/route', { timeout: 12000 });
  await button.click();
  expect((await request).postDataJSON()).toMatchObject({ mode: 'wheelchair', gender: 'female',
    origin: { lat: anchor.coordinates[0], lon: anchor.coordinates[1], floor: -1 },
    destination: { type: 'door', accessId: 42, areaId: 24, lat: destination.coordinates[0], lon: destination.coordinates[1], floor: 0 } });
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  await expect(page.locator('.instruction-text')).toContainText('حرکت از موقعیت جدید');
  expect(await page.evaluate(() => ({ origin: JSON.parse(sessionStorage.getItem('origin')),
    destination: JSON.parse(sessionStorage.getItem('destination')), floor: sessionStorage.getItem('haramCurrentFloor') })))
    .toMatchObject({ origin: { coordinates: anchor.coordinates, floor: -1 }, destination, floor: '-1' });
  await expectCameraReleased(page);
});

test('invalid QR and unavailable route preserve the active route and allow a retry', async ({ page }) => {
  const button = await startRoute(page);
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ status: 404, json: {} }), { times: 1 });
  await button.click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ثبت نشده');
  await expectCameraReleased(page);
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ json: anchor }));
  await page.route('**/api/v1/routing/route', route => route.fulfill({ status: 422, json: {} }));
  await page.getByRole('button', { name: 'تلاش دوباره' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('مسیری به مقصد پیدا نشد');
  await page.getByRole('button', { name: 'ادامهٔ مسیر فعلی' }).click();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('origin')))).toEqual(origin);
  await expectCameraReleased(page);
});

test('cancelling a route correction ignores its pending result', async ({ page }) => {
  const button = await startRoute(page);
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ json: anchor }));
  let finishRoute;
  await page.route('**/api/v1/routing/route', async route => {
    await new Promise(resolve => { finishRoute = resolve; });
    await route.fulfill({ json: correctedRoute });
  });
  await button.click();
  await expect.poll(() => !!finishRoute).toBe(true);
  await expect(page.getByRole('dialog').getByRole('status')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  finishRoute();
  await expect(button).toBeFocused();
  await expectCameraReleased(page);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('origin')))).toEqual(origin);
});
