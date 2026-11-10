import { test, expect } from '@playwright/test';
import { DEFAULT_NAVIGATION_POLICY } from '../../src/services/navigationPolicy.js';
// These pre-existing cases cover the optional GPS policy. Haram defaults are tested separately.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(policy => localStorage.setItem('navigation-policy-v1', JSON.stringify(policy)),
    { ...DEFAULT_NAVIGATION_POLICY, gps_enabled: true });
});
import { readFileSync } from 'node:fs';
import { normalizeRouteSnapshot } from '../../src/services/routingService.js';

const raw = JSON.parse(readFileSync(new URL('../fixtures/rng-server-route.json', import.meta.url)));
const origin = { name: 'مبدأ', floor: 0, coordinates: [36.287, 59.615] };
const destination = { name: 'مقصد', floor: 0, coordinates: [36.288, 59.616] };

async function setup(page, loggedIn = false) {
  const snapshot = normalizeRouteSnapshot(raw, origin, destination);
  await page.addInitScript(({ snapshot, origin, destination, loggedIn }) => {
    const state = { origin, destination, routeGeo: snapshot.geo, routeSteps: snapshot.steps,
      alternativeRoutes: [], transportMode: 'walking', gender: 'both' };
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
    for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('haramCurrentFloor', '0');
    sessionStorage.setItem('qrLat', '36.287');
    sessionStorage.setItem('qrLng', '59.615');
    if (loggedIn) localStorage.setItem('gp_user_auth_store', JSON.stringify({ state: {
      accessToken: 'persisted-token', refreshToken: 'refresh-token', user: { id: 42, name: 'test' }
    }, version: 0 }));
    window.__gpsWatches = new Map();
    let next = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: () => {},
      watchPosition: success => { window.__gpsWatches.set(++next, success); return next; },
      clearWatch: id => window.__gpsWatches.delete(id)
    } });
    window.__sendGps = (lat, lng, accuracy = 20, age = 0) => {
      for (const success of window.__gpsWatches.values()) success({ timestamp: Date.now() - age,
        coords: { latitude: lat, longitude: lng, accuracy, heading: null } });
    };
    window.DeviceMotionEvent = class {};
    window.DeviceOrientationEvent = class {};
  }, { snapshot, origin, destination, loggedIn });
  await page.route('**/api/v1/**', route => route.fulfill({ json: { data: [], features: [] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/rng');
  await expect(page.locator('.emergency-button')).toBeVisible();
}

async function openEmergency(page) {
  await page.locator('.emergency-button').click();
  await page.locator('.emergency-option').nth(2).click();
  await page.locator('.emergency-textarea').fill('درخواست آزمایشی؛ بدون ارسال واقعی');
}

test('emergency failure keeps draft; retry is idempotent and double click sends once', async ({ page }) => {
  await setup(page);
  const sent = [];
  let release;
  await page.route('**/api/v1/emergencies', async route => {
    const body = route.request().postDataJSON();
    sent.push(body);
    if (sent.length === 1) return route.fulfill({ status: 503, json: { message: 'unavailable' } });
    await new Promise(resolve => { release = resolve; });
    return route.fulfill({ status: 201, json: { id: 15, status: 'received', requestId: body.requestId } });
  });
  await openEmergency(page);
  await page.locator('.emergency-submit-button').click();
  await expect(page.locator('.Toastify__toast--error')).toBeVisible();
  await expect(page.locator('.emergency-textarea')).not.toHaveValue('');
  expect(sent[0].location).toBeNull();
  await page.locator('.emergency-submit-button').dblclick();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1]).toEqual(sent[0]);
  release();
  await expect(page.locator('.emergency-modal')).toHaveCount(0);
  await expect(page.locator('.Toastify__toast--success')).toBeVisible();
});

test('persisted user login and QR still allow fresh 20m GPS in an emergency', async ({ page }) => {
  await setup(page, true);
  let sent, authorization;
  await page.route('**/api/v1/emergencies', route => {
    sent = route.request().postDataJSON();
    authorization = route.request().headers().authorization;
    return route.fulfill({ status: 201, json: { id: 16, status: 'received', requestId: sent.requestId } });
  });
  await page.evaluate(() => window.__sendGps(36.289, 59.617));
  await page.locator('.start-routing-button').click();
  await openEmergency(page);
  await page.locator('.emergency-submit-button').click();
  await expect(page.locator('.emergency-modal')).toHaveCount(0);
  expect(authorization).toBe('Bearer persisted-token');
  expect(sent.location).toMatchObject({ lat: 36.289, lng: 59.617, source: 'gps', accuracy: 20 });
  await page.evaluate(() => { window.location.hash = '#/notifications'; });
  await expect(page.locator('.notification-card')).toHaveCount(1);
  await page.locator('.notification-card').click();
  await page.reload();
  await expect(page.locator('.notification-card.read')).toHaveCount(1);
  await expect(page.locator('.notification-card.unread')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gp_notifications:42'))[0].id)).toBe('emergency:16');
});

test('stale GPS is not sent as the incident location and DR stops on leaving navigation', async ({ page }) => {
  await setup(page);
  let sent;
  await page.route('**/api/v1/emergencies', route => {
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: 17, status: 'received', requestId: sent.requestId } });
  });
  await page.evaluate(() => window.__sendGps(36.289, 59.617, 5, 60000));
  await openEmergency(page);
  await page.locator('.emergency-submit-button').click();
  await expect(page.locator('.emergency-modal')).toHaveCount(0);
  expect(sent.location).toBeNull();
  await page.locator('.start-routing-button').click();
  expect(await page.evaluate(async () => (await import('/src/services/AdvancedDeadReckoningService.js')).default.isActive)).toBe(true);
  await page.evaluate(() => { window.location.hash = '#/mpb'; });
  await expect(page.locator('.routing-page')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/services/AdvancedDeadReckoningService.js')).default.isActive)).toBe(false);
});

test('saved destinations include records after the first 50', async ({ page }) => {
  await setup(page, true);
  await page.route('**/api/v1/destinations?**', route => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    const items = pageNumber === 1
      ? Array.from({ length: 50 }, (_, index) => ({ id: index + 1, title: `Saved ${index + 1}`, x: 734000, y: 4019000, floor: 0 }))
      : [{ id: 51, title: 'Saved 51', x: 734000, y: 4019000, floor: 0 }];
    return route.fulfill({ json: { items, pagination: { page: pageNumber, page_size: 50, total: 51 } } });
  });
  await page.evaluate(() => { window.location.hash = '#/pfp'; });
  await expect(page.locator('.location-card-pfp')).toHaveCount(51);
  await expect(page.getByText('Saved 51', { exact: true })).toBeVisible();
});

test('saved-place search uses real POIs rather than the missing vector tile layer', async ({ page }) => {
  await setup(page, true);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/landmark-places**', route => route.fulfill({ json: { places: {
    landmarkPlaces: [{ id: 101, title: 'مکان آزمایش', lat: 36.287, lng: 59.615, floor: 0, address: 'نشانی آزمایش' }]
  } } }));
  await page.evaluate(() => { window.location.hash = '#/pmap'; });
  await page.locator('.pmap-search-input').click();
  await page.locator('.pmap-search-modal input').fill('مکان');
  await expect(page.getByText('مکان آزمایش', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('language service outage still permits entering the application', async ({ page }) => {
  await page.route('**/api/v1/languages', route => route.abort());
  await page.goto('/#/');
  await expect(page.locator('.lang-option')).toHaveCount(4);
  await expect(page.locator('.lang-login-btn')).toBeEnabled();
  await page.locator('.lang-login-btn').click();
  await expect(page).toHaveURL(/#\/mpb$/);
});
