import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { normalizeRouteSnapshot } from '../../src/services/routingService.js';
import { sliceLineByFraction, haversineMeters } from '../../src/utils/routeSegments.js';

// Captured from the public routing API for 36.287,59.615 -> 36.288,59.616.
const realRoute = JSON.parse(readFileSync(new URL('../fixtures/rng-server-route.json', import.meta.url)));
const origin = { name: 'مبدأ', floor: 0, coordinates: [36.287, 59.615] };
const destination = { name: 'مقصد', floor: 0, coordinates: [36.288, 59.616] };

async function setup(page, raw = realRoute, waitForMap = true) {
  const snapshot = normalizeRouteSnapshot(raw, origin, destination);
  await page.addInitScript(({ snapshot, origin, destination }) => {
    const state = { origin, destination, routeGeo: snapshot.geo, routeSteps: snapshot.steps,
      alternativeRoutes: [], transportMode: 'walking', gender: 'both' };
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
    for (const [key, value] of Object.entries(state)) sessionStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('haramCurrentFloor', '0');
    window.__sendGps = () => {};
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: success => success({ coords: { latitude: 36.287, longitude: 59.615, accuracy: 5 } }),
      watchPosition: success => { window.__sendGps = (lat, lng) => success({ coords: { latitude: lat, longitude: lng, accuracy: 5, heading: 270 } }); return 1; },
      clearWatch: () => {}
    } });
  }, { snapshot, origin, destination });
  await page.route('**/api/v1/**', route => route.fulfill({ json: { status: 'NO_MATCH', data: [], features: [] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  const tile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aP0AAAAASUVORK5CYII=', 'base64');
  await page.route('**/tms/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: tile }));
  await page.goto('/#/');
  // Observe the actual MapLibre camera and marker without changing application UI.
  await page.evaluate(async () => {
    const source = await (await fetch('/src/components/map/RouteMap.jsx')).text();
    const modulePath = source.match(/["']([^"']*\/maplibre-gl\.js\?[^"']+)["']/)?.[1];
    if (!modulePath) throw new Error('MapLibre module not found');
    const lib = (await import(modulePath)).default;
    const originalEase = lib.Map.prototype.easeTo;
    lib.Map.prototype.easeTo = function (...args) { window.__rngMap = this; return originalEase.apply(this, args); };
    const originalMarker = lib.Marker.prototype.setLngLat;
    lib.Marker.prototype.setLngLat = function (...args) {
      window.__rngMarkers ||= new Set(); window.__rngMarkers.add(this);
      return originalMarker.apply(this, args);
    };
  });
  await page.evaluate(() => { window.location.hash = '#/rng'; });
  await expect(page.locator('.direction-icon-rng')).toBeVisible();
  if (waitForMap) await expect.poll(() => page.evaluate(() => !!window.__rngMap), { timeout: 20000 }).toBe(true);
  return snapshot;
}

async function readMap(page) {
  return page.evaluate(() => {
    const map = window.__rngMap;
    const marker = [...window.__rngMarkers].find(m => m.getElement().querySelector('#soft-shadow'));
    const end = source => {
      const data = map.getSource(source)?._data;
      return data?.geometry?.coordinates?.at(-1);
    };
    return { center: [map.getCenter().lng, map.getCenter().lat], bearing: (map.getBearing() + 360) % 360,
      marker: marker && [marker.getLngLat().lng, marker.getLngLat().lat],
      traveledEnd: end('traveled-route'), moving: map.isMoving() };
  });
}

const close = (a, b, meters = 0.4) => a && b && haversineMeters(a, b) < meters;
const bearing = (a, b) => {
  const rad = Math.PI / 180;
  const d = (b[0] - a[0]) * rad;
  const x = Math.cos(a[1] * rad) * Math.sin(b[1] * rad)
    - Math.sin(a[1] * rad) * Math.cos(b[1] * rad) * Math.cos(d);
  const y = Math.sin(d) * Math.cos(b[1] * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
};

function expectedBearing(coords, routeM) {
  const forward = sliceLineByFraction(coords, routeM, 1);
  const next = forward.slice(1).find(p => haversineMeters(forward[0], p) > 0.001);
  if (next) return bearing(forward[0], next);
  const before = sliceLineByFraction(coords, 0, routeM);
  const previous = before.slice(0, -1).reverse().find(p => haversineMeters(p, before.at(-1)) > 0.001);
  return bearing(previous, before.at(-1));
}

async function expectFrame(page, snapshot, index) {
  const step = snapshot.steps[index + 1];
  const expected = sliceLineByFraction(snapshot.geo.geometry.coordinates, step.routeM ?? 1, step.routeM ?? 1)[0];
  await expect(page.locator('.routing-page')).toHaveAttribute('data-current-step', String(index));
  const instruction = page.locator('.instruction-text');
  if (step.type === 'stepArriveDestination') {
    await expect(instruction).toContainText('رسیدن');
  } else {
    const expectedText = /^area \d+$/.test(step.toAreaName)
      ? 'مسیر را ادامه دهید.'
      : `وارد ${step.toAreaName} شوید.`;
    await expect(instruction).toContainText(expectedText);
    await expect(instruction).not.toContainText(String(step.doorId));
  }
  await expect.poll(async () => {
    const actual = await readMap(page);
    return !actual.moving && close(actual.marker, expected) && close(actual.center, expected)
      && close(actual.traveledEnd, expected);
  }, { timeout: 10000 }).toBe(true);
  const actual = await readMap(page);
  const expectedHeading = expectedBearing(snapshot.geo.geometry.coordinates, step.routeM ?? 1);
  expect(Math.abs(((actual.bearing - expectedHeading + 540) % 360) - 180)).toBeLessThan(1);
  return actual;
}

test('real route: each preview, rapid clicks, panel states and wrap stay synchronized', async ({ page }) => {
  const snapshot = await setup(page);
  const first = await expectFrame(page, snapshot, 0);
  expect(first.bearing).toBeGreaterThan(35);
  expect(first.bearing).toBeLessThan(60);
  await page.locator('.direction-icon-rng').click();
  await expectFrame(page, snapshot, 1);
  await page.locator('.expand-button').click();
  await expect(page.locator('.info-modal')).toHaveClass(/closed/);
  await page.locator('.direction-icon-rng').evaluate(el => { el.click(); el.click(); el.click(); });
  await expectFrame(page, snapshot, 4);
  await page.waitForTimeout(850);
  await expectFrame(page, snapshot, 4);
  await page.evaluate(() => window.__sendGps(36.29, 59.62));
  await expectFrame(page, snapshot, 4);
  await page.locator('.expand-button').click();
  await expect(page.locator('.info-modal')).toHaveClass(/open/);
  await page.locator('.direction-icon-rng').click();
  await expectFrame(page, snapshot, 5);
  await page.locator('.direction-icon-rng').click();
  await expectFrame(page, snapshot, 6);
  await page.locator('.direction-icon-rng').click();
  await expectFrame(page, snapshot, 0);
});

test('repeated vertices on a bend preserve the local heading and endpoint', async ({ page }) => {
  const raw = structuredClone(realRoute);
  raw.geo.geometry.coordinates.splice(2, 0, raw.geo.geometry.coordinates[1]);
  const snapshot = await setup(page, raw);
  const first = await expectFrame(page, snapshot, 0);
  expect(first.bearing).toBeGreaterThan(35);
  expect(first.bearing).toBeLessThan(60);
  await page.locator('.direction-icon-rng').evaluate(el => { el.click(); el.click(); el.click(); });
  const fourth = await expectFrame(page, snapshot, 3);
  expect(fourth.bearing).toBeGreaterThan(5);
  expect(fourth.bearing).toBeLessThan(25);
});

test('floor transfer, arrival and wrap keep their own positions and floors', async ({ page }) => {
  const a = [[59.615, 36.287], [59.6151, 36.287]];
  const b = [[59.6151, 36.287], [59.6151, 36.2871]];
  const geo = { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [a, b] },
    properties: { multifloor: true, distanceMeters: 20, durationSeconds: 56, segments: [
      { id: 0, kind: 'walk', floor: 0, geometry: { type: 'LineString', coordinates: a }, duration_s: 10 },
      { id: 1, kind: 'elevator', floor: 0, fromFloor: 0, toFloor: -1, geometry: null, duration_s: 36 },
      { id: 2, kind: 'walk', floor: -1, geometry: { type: 'LineString', coordinates: b }, duration_s: 10 }
    ] } };
  const raw = { multifloor: true, geo, steps: [
    { type: 'stepStart', instruction: 'حرکت همکف', segmentId: 0, floor: 0, routeM: 0, coord: { lon: a[0][0], lat: a[0][1] } },
    { type: 'stepChangeFloor', instruction: 'انتقال طبقه', segmentId: 1, floor: 0, fromFloor: 0, toFloor: -1, coord: { lon: a[1][0], lat: a[1][1] } },
    { type: 'stepStart', instruction: 'حرکت زیرزمین', segmentId: 2, floor: -1, routeM: 0, coord: { lon: b[0][0], lat: b[0][1] } },
    { type: 'stepArriveDestination', instruction: 'رسیدن به مقصد', segmentId: 2, floor: -1, routeM: 1, coord: { lon: b[1][0], lat: b[1][1] } }
  ], alternatives: [] };
  await setup(page, raw);
  const check = async (index, text, floor, point) => {
    await expect(page.locator('.routing-page')).toHaveAttribute('data-current-step', String(index));
    await expect(page.locator('.instruction-text')).toContainText(text);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('haramCurrentFloor'))).toBe(String(floor));
    await expect.poll(async () => {
      const map = await readMap(page);
      return !map.moving && close(map.center, point) && close(map.marker, point);
    }, { timeout: 10000 }).toBe(true);
  };
  await check(0, 'حرکت همکف', 0, a[0]);
  await page.locator('.direction-icon-rng').click();
  await check(1, 'انتقال طبقه', 0, a[1]);
  expect((await readMap(page)).bearing).toBeGreaterThan(89);
  expect((await readMap(page)).bearing).toBeLessThan(91);
  await page.locator('.direction-icon-rng').click();
  await check(2, 'حرکت زیرزمین', -1, b[0]);
  await page.locator('.direction-icon-rng').click();
  await check(3, 'رسیدن به مقصد', -1, b[1]);
  await page.locator('.direction-icon-rng').click();
  await check(0, 'حرکت همکف', 0, a[0]);
});

test('starting actual navigation resets the selected preview to the route start', async ({ page }) => {
  await setup(page, realRoute, false);
  await page.locator('.direction-icon-rng').click();
  await page.locator('.direction-icon-rng').click();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-current-step', '2');
  await page.evaluate(async () => {
    const service = (await import('/src/services/AdvancedDeadReckoningService.js')).default;
    service.start = async position => { window.__navigationStart = position; };
  });
  await page.locator('.start-routing-button').click();
  await expect(page.locator('.routing-page')).toHaveAttribute('data-current-step', '0');
  await expect(page.locator('.routing-page')).toHaveAttribute('data-navigation-mode', 'live');
  expect(await page.evaluate(() => window.__navigationStart)).toEqual({ lat: 36.287, lng: 59.615 });
});
