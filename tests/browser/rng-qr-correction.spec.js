import { test, expect } from '@playwright/test';
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

const nearbyStart = [point(anchor)[0], point(anchor)[1] + 0.00016];
const nearbyRoute = structuredClone(correctedRoute);
nearbyRoute.geo.geometry.coordinates[0][0] = nearbyStart;
nearbyRoute.geo.properties.segments[0].geometry.coordinates[0] = nearbyStart;
nearbyRoute.geo.properties.nearbyOrigin = { coordinates: [nearbyStart[1], nearbyStart[0]], floor: -1 };
nearbyRoute.steps[0] = step('stepStart', -1, 0, 0, nearbyStart, { instruction: 'از نقطهٔ نزدیک مبدأ شروع کنید.' });
const coordinateDestination = { name: destination.name, floor: destination.floor, coordinates: destination.coordinates };

// Keep the decoded QR real while supplying frames independently of Chrome's fake capture file.
const qr = QRCode.create(`https://example.org/#/location?lat=1&lng=2&floor=5&id=${code}`).modules;
const qrFrame = { size: qr.size, pixels: Array.from(qr.data) };

async function presentQr(page, action) {
  const count = await page.evaluate(() => window.cameraTracks.length);
  await action.click();
  await expect.poll(() => page.evaluate(() => window.cameraTracks.length)).toBe(count + 1);
  await expect.poll(() => page.locator('.rng-qr-camera video').evaluate(video =>
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0
  )).toBe(true);
  await page.evaluate(() => window.showQrFrame());
}

async function startRoute(page, endpoint = destination) {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.addInitScript(({ origin, destination, firstRoute, qrFrame }) => {
    const state = { origin, destination, routeGeo: firstRoute.geo, routeSteps: firstRoute.steps,
      alternativeRoutes: [], transportMode: 'wheelchair', gender: 'female' };
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
    for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('haramCurrentFloor', '0');
    Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition() {},
      watchPosition: callback => { window.sendGps = callback; return 1; }, clearWatch() {} } });
    window.cameraTracks = [];
    navigator.mediaDevices.getUserMedia = async () => {
      const scale = 8;
      const quietZone = 4;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = (qrFrame.size + 2 * quietZone) * scale;
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const stream = canvas.captureStream(0);
      const [track] = stream.getVideoTracks();
      window.cameraTracks.push(track);
      track.requestFrame();
      window.showQrFrame = () => {
        track.requestFrame();
        context.fillStyle = '#000';
        for (const [index, black] of qrFrame.pixels.entries()) {
          if (black) context.fillRect(
            (index % qrFrame.size + quietZone) * scale,
            (Math.floor(index / qrFrame.size) + quietZone) * scale,
            scale, scale
          );
        }
      };
      return stream;
    };
  }, { origin, destination: endpoint, firstRoute, qrFrame });
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
  const reader = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/zxing_reader.wasm')
    && !new URL(response.url()).searchParams.has('import'));
  const button = await startRoute(page);
  const wasm = await reader;
  expect(wasm.ok()).toBe(true);
  expect((await wasm.body()).subarray(0, 4)).toEqual(Buffer.from([0, 0x61, 0x73, 0x6d]));
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
  const [request] = await Promise.all([
    page.waitForRequest('**/api/v1/routing/route', { timeout: 12000 }),
    presentQr(page, button),
  ]);
  expect(request.postDataJSON()).toMatchObject({ mode: 'wheelchair', gender: 'female',
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

test('QR correction can use a nearby route start while retaining the QR position and exact destination on resume', async ({ page }) => {
  const button = await startRoute(page, coordinateDestination);
  await page.getByRole('button', { name: 'توقف موقت', exact: true }).click();
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ json: anchor }));
  await page.route('**/api/v1/routing/route', route => route.fulfill({ json: nearbyRoute }));
  const request = page.waitForRequest('**/api/v1/routing/route');
  await presentQr(page, button);
  expect((await request).postDataJSON()).toMatchObject({ allowNearbyDestination: true,
    origin: { lat: anchor.coordinates[0], lon: anchor.coordinates[1], floor: -1 },
    destination: { type: 'coordinate', lat: coordinateDestination.coordinates[0],
      lon: coordinateDestination.coordinates[1], floor: 0 } });
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'paused');
  const state = await page.evaluate(() => ({
    origin: JSON.parse(sessionStorage.getItem('origin')),
    destination: JSON.parse(sessionStorage.getItem('destination')),
    pause: JSON.parse(sessionStorage.getItem('rngPausedNavigation')),
  }));
  expect(state).toMatchObject({ origin: { coordinates: anchor.coordinates }, destination: coordinateDestination,
    pause: { step: 0, frame: { geo: { lat: anchor.coordinates[0], lng: anchor.coordinates[1] } } } });
  await expect(page.locator('.instruction-text')).toContainText('از نقطهٔ نزدیک مبدأ شروع کنید');
  await page.getByRole('button', { name: 'ادامه مسیر', exact: true }).click();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  await expect(page.locator('.instruction-text')).toContainText('از نقطهٔ نزدیک مبدأ شروع کنید');
});

test('QR correction rejects a route that substitutes a nearby destination', async ({ page }) => {
  const button = await startRoute(page, coordinateDestination);
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ json: anchor }));
  const result = structuredClone(nearbyRoute);
  result.geo.properties.nearbyDestination = { coordinates: [36.2881, 59.6161], floor: 0 };
  await page.route('**/api/v1/routing/route', route => route.fulfill({ json: result }));
  await presentQr(page, button);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('مسیری به مقصد پیدا نشد');
  const state = await page.evaluate(() => ({
    origin: JSON.parse(sessionStorage.getItem('origin')),
    destination: JSON.parse(sessionStorage.getItem('destination')),
    geo: JSON.parse(sessionStorage.getItem('routeGeo')),
  }));
  expect(state).toEqual({ origin, destination: coordinateDestination, geo: firstRoute.geo });
});

test('invalid QR and unavailable route preserve the active route and allow a retry', async ({ page }) => {
  const button = await startRoute(page);
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ status: 404, json: {} }), { times: 1 });
  await presentQr(page, button);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('ثبت نشده');
  await expectCameraReleased(page);
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ json: anchor }));
  await page.route('**/api/v1/routing/route', route => route.fulfill({ status: 422, json: {} }));
  await presentQr(page, page.getByRole('button', { name: 'تلاش دوباره' }));
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('مسیری به مقصد پیدا نشد');
  await page.getByRole('button', { name: 'ادامهٔ مسیر فعلی' }).click();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('origin')))).toEqual(origin);
  await expectCameraReleased(page);
});

test('QR correction during a pause preserves the pause and resumes from the scanned floor without GPS', async ({ page }) => {
  const button = await startRoute(page);
  await page.getByRole('button', { name: 'توقف موقت', exact: true }).click();
  await page.route(`**/api/v1/qrcodes/${code}?*`, route => route.fulfill({ json: anchor }));
  await page.route('**/api/v1/routing/route', route => route.fulfill({ json: correctedRoute }));
  await presentQr(page, button);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'paused');
  await expect(page.locator('.instruction-text')).toContainText('حرکت از موقعیت جدید');
  await page.getByRole('button', { name: 'ادامه مسیر', exact: true }).click();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  expect(await page.evaluate(() => sessionStorage.getItem('haramCurrentFloor'))).toBe('-1');
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
  await presentQr(page, button);
  await expect.poll(() => !!finishRoute).toBe(true);
  await expect(page.getByRole('dialog').getByRole('status')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  finishRoute();
  await expect(button).toBeFocused();
  await expectCameraReleased(page);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('origin')))).toEqual(origin);
});
