import test from 'node:test';
import assert from 'node:assert/strict';
import { NavigationProgressTracker } from '../src/utils/navigationProgressTracker.js';
import { gpsMeasurement } from '../src/utils/locationQuality.js';
import dr, { DR_MAX_ANCHOR_AGE } from '../src/services/AdvancedDeadReckoningService.js';
import { captureQrLocation, resolveQrPoint, readQrPoint } from '../src/services/qrLocationService.js';

const start = { lat: 36.288, lng: 59.6157 };
const point = (x, y = 0) => [start.lng + x / (111320 * Math.cos(start.lat * Math.PI / 180)), start.lat + y / 111320];
const fix = (x, y, timestamp, accuracy = 2) => {
  const [lng, lat] = point(x, y);
  return { lat, lng, timestamp, accuracy };
};
const now = Date.now();

test('four metres of noise cannot jump to the return leg of a six-metre-wide U route', () => {
  const tracker = new NavigationProgressTracker();
  const coordinates = [point(0), point(100), point(100, 6), point(0, 6)];
  const steps = [{ fromM: 0 }, { fromM: 0.48 }, { fromM: 0.52 }, { fromM: 1 }];
  for (let i = 0; i < 8; i++) {
    const result = tracker.update({ measurement: fix(5, 4, now + i * 1000), steps, currentStep: 0,
      coordinates, context: 'u', now: now + i * 1000 });
    assert.equal(result.nextStep, 0);
    assert.ok(tracker.routeM < 0.04);
  }
});

test('poor GPS cannot advance or arrive; arrival needs three distinct precise observations', () => {
  const tracker = new NavigationProgressTracker();
  const coordinates = [point(0), point(5)];
  const steps = [{ type: 'stepArriveDestination', fromM: 0 }];
  const update = (time, accuracy) => tracker.update({ measurement: fix(5, 0, time, accuracy), steps, currentStep: 0,
    coordinates, context: 'arrival', now: time });
  assert.equal(update(now, 25).arrived, false);
  assert.equal(update(now + 1000, 2).arrived, false);
  assert.equal(update(now + 1000, 2).arrived, false);
  assert.equal(update(now + 2000, 2).arrived, false);
  assert.equal(update(now + 3000, 2).arrived, true);
});

test('new observations follow a normal walk and one fix cannot cascade through several steps', () => {
  const tracker = new NavigationProgressTracker();
  const coordinates = [point(0), point(30)];
  const steps = [{ fromM: 0 }, { fromM: 0.4 }, { fromM: 0.7 }, { fromM: 1 }];
  let currentStep = 0;
  for (let i = 0; i <= 30; i++) {
    const args = { measurement: fix(i, 0, now + i * 1000), steps, currentStep, coordinates, context: 'walk', now: now + i * 1000 };
    currentStep = tracker.update(args).nextStep;
    assert.equal(tracker.update({ ...args, currentStep }).nextStep, currentStep);
  }
  assert.equal(currentStep, 3);
});

test('stale, invalid, approximate and out-of-order GPS do not become a routing origin', () => {
  const position = { timestamp: now, coords: { latitude: start.lat, longitude: start.lng, accuracy: 5 } };
  assert.equal(gpsMeasurement(position, null, now).accuracy, 5);
  for (const p of [{ ...position, timestamp: now - 60000 }, { ...position, coords: { ...position.coords, accuracy: 100 } },
    { ...position, coords: { ...position.coords, latitude: NaN } }]) assert.equal(gpsMeasurement(p, null, now), null);
  assert.equal(gpsMeasurement(position, { timestamp: now + 1 }, now), null);
});

test('unverified, expired and overlong anchors cannot generate fresh DR positions', async t => {
  // Node's mock property API is not needed: restore globals explicitly for Node 20 too.
  const oldWindow = globalThis.window, oldMotion = globalThis.DeviceMotionEvent;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.DeviceMotionEvent = {};
  t.after(() => { dr.stop(); globalThis.window = oldWindow; globalThis.DeviceMotionEvent = oldMotion; });
  for (const quality of [{ trusted: false }, { timestamp: now - DR_MAX_ANCHOR_AGE - 1 }]) {
    await dr.start(start, quality);
    dr._handleOrientation({ type: 'deviceorientationabsolute', alpha: 270 });
    dr._processStep();
    assert.equal(dr.positionTimestamp, null);
    assert.deepEqual(dr.geoPosition, start);
  }
  await dr.start(start, { accuracy: 2 });
  dr._handleOrientation({ type: 'deviceorientationabsolute', alpha: 270 });
  for (let i = 0; i < 100; i++) dr._processStep();
  assert.equal(dr.positionTimestamp, null);
  assert.ok(dr.distanceSinceAnchor <= 30);
});

test('a coarse GPS fix cannot replace a fresh QR anchor', async t => {
  const oldWindow = globalThis.window, oldMotion = globalThis.DeviceMotionEvent;
  globalThis.window = { addEventListener() {}, removeEventListener() {} }; globalThis.DeviceMotionEvent = {};
  t.after(() => { dr.stop(); globalThis.window = oldWindow; globalThis.DeviceMotionEvent = oldMotion; });
  await dr.start(start, { accuracy: 2 });
  assert.equal(dr.processGpsData(fix(20, 0, now), 25, Date.now()), false);
  assert.deepEqual(dr.geoPosition, start);
});

function storage(t) {
  const old = globalThis.sessionStorage;
  const values = new Map();
  globalThis.sessionStorage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k, String(v)), removeItem: k => values.delete(k) };
  t.after(() => { if (old === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = old; });
  return values;
}

test('registered QR coordinates and floor always come from the server, even if the URL supplies a floor', async t => {
  storage(t);
  captureQrLocation(new URLSearchParams('id=QR-TEST&lat=1&lng=2&floor=5'));
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, status: 200,
    json: async () => ({ id: 'QR-TEST', coordinates: [start.lat, start.lng], floor: -1 }) }));
  const resolved = await resolveQrPoint();
  assert.deepEqual(resolved.coordinates, [start.lat, start.lng]);
  assert.equal(resolved.floor, -1);
  assert.equal(resolved.verified, true);
});

test('invalid and disabled QR entries clear previous anchors rather than reusing them', async t => {
  storage(t);
  captureQrLocation(new URLSearchParams('lat=999&lng=abc'));
  assert.equal(readQrPoint(), null);
  captureQrLocation(new URLSearchParams('id=QR-DISABLED-12&lat=36&lng=59&floor=0'));
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; return { ok: false, status: 404 }; });
  assert.equal(await resolveQrPoint(), null);
  assert.equal(readQrPoint(), null);
  assert.equal(requests, 1, 'a disabled QR is not interpreted as POI 12');
});

test('a late QR response cannot replace a newer scan', async t => {
  storage(t);
  captureQrLocation(new URLSearchParams('id=FIRST&lat=36&lng=59'));
  let respond;
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { respond = resolve; }));
  const pending = resolveQrPoint();
  captureQrLocation(new URLSearchParams('id=SECOND&lat=37&lng=60'));
  respond({ ok: true, status: 200, json: async () => ({ id: 'FIRST', coordinates: [38,61], floor: -1 }) });
  assert.equal(await pending, null);
  assert.deepEqual(readQrPoint().coordinates, [37,60]);
});


test('stride calibration needs two consistent measured straight walks and rejects turns', async t => {
  const oldWindow = globalThis.window, oldMotion = globalThis.DeviceMotionEvent;
  globalThis.window = { addEventListener() {}, removeEventListener() {} }; globalThis.DeviceMotionEvent = {};
  t.after(() => { dr.stop(); globalThis.window = oldWindow; globalThis.DeviceMotionEvent = oldMotion; });
  await dr.start(start, { accuracy: 2 });
  dr.calibrated = false; dr._strideSample = null;
  dr._handleOrientation({ type: 'deviceorientationabsolute', alpha: 270 });
  const stamp = Date.now();
  dr._calibrateStride(fix(0, 0, stamp), 1, stamp);
  dr.stepCount = 30;
  dr._calibrateStride(fix(24, 0, stamp + 20000), 1, stamp + 20000);
  assert.equal(dr.calibrated, false);
  dr.stepCount = 60;
  dr._calibrateStride(fix(48, 0, stamp + 40000), 1, stamp + 40000);
  assert.equal(dr.calibrated, true);
  assert.ok(Math.abs(dr.stepLengthMeters - 0.8) < 0.01);
  dr._handleOrientation({ type: 'deviceorientationabsolute', alpha: 180 });
  assert.equal(dr._calibration, null);
});

test('numeric cultural QR links resolve their registered POI instead of trusting URL coordinates', async t => {
  storage(t);
  captureQrLocation(new URLSearchParams('id=123&lat=1&lng=2'));
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.includes('/qrcodes/')) return { ok: false, status: 404 };
    assert.equal(new URL(url).searchParams.get('poi_id'), '123');
    return { ok: true, json: async () => ({ places: { landmarkPlaces: [{ id: 123, coordinates: [36.3,59.6], floor: -1 }] } }) };
  });
  assert.deepEqual((await resolveQrPoint()).coordinates, [36.3,59.6]);
});

test('resume refuses an ambiguous GPS position between nearby return legs', async () => {
  const { resumeStepAt } = await import('../src/utils/rngPause.js');
  const coordinates = [point(0), point(100), point(100, 6), point(0, 6)];
  assert.throws(() => resumeStepAt(fix(5, 4, Date.now(), 3), [{ fromM: 0 }, { fromM: 0.5 }], 0, coordinates), /location/);
});


test('an explicitly revalidated resume seeds progress inside a long step', () => {
  const tracker = new NavigationProgressTracker();
  tracker.reset(0.6);
  const result = tracker.update({ measurement: fix(60, 0, now), steps: [{ fromM: 0 }, { fromM: 1 }],
    currentStep: 0, coordinates: [point(0), point(100)], context: 'resume', now });
  assert.equal(result.nextStep, 0);
  assert.ok(Math.abs(tracker.routeM - 0.6) < 0.01);
});


test('QR route planning does not expire a 30-second anchor before its 60-second budget', async t => {
  const oldWindow = globalThis.window, oldMotion = globalThis.DeviceMotionEvent;
  globalThis.window = { addEventListener() {}, removeEventListener() {} }; globalThis.DeviceMotionEvent = {};
  t.after(() => { dr.stop(); globalThis.window = oldWindow; globalThis.DeviceMotionEvent = oldMotion; });
  const timestamp = Date.now() - 30000;
  await dr.start(start, { timestamp, accuracy: 2 });
  dr._handleOrientation({ type: 'deviceorientationabsolute', alpha: 270 });
  dr._processStep();
  assert.equal(dr.anchorTimestamp, timestamp);
  assert.ok(dr.positionTimestamp >= timestamp + 30000);
});
