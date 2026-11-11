import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NAVIGATION_POLICY as defaults, setNavigationPolicy, getNavigationPolicy,
  validNavigationPolicy, loadNavigationPolicy } from '../src/services/navigationPolicy.js';
import { NavigationProgressTracker } from '../src/utils/navigationProgressTracker.js';
import dr from '../src/services/AdvancedDeadReckoningService.js';
import { observeGps } from '../src/utils/locationQuality.js';

const point = (m, offset = 0) => ({ lat: m / 111195, lng: offset / 111195 });
const coordinates = [[0, 0], [0, 50 / 111195]];
const steps = [{ fromM: 0 }, { fromM: 0.5 }, { fromM: 1, type: 'stepArriveDestination' }];
function feed(tracker, m, { currentStep = 0, heading = 0, offset = 0, ...extra } = {}) {
  const timestamp = 100000 + Math.round(m * 1000);
  return tracker.update({ measurement: { ...point(m, offset), heading, timestamp, positionTimestamp: timestamp,
    distanceSinceAnchor: m, source: 'dead_reckoning', ...extra },
    steps, currentStep, coordinates, context: 'trip|0', now: timestamp, mode: 'walk' });
}
test.beforeEach(() => setNavigationPolicy(defaults));

test('default policy does not acquire or consume GPS, even with plausible accuracy', () => {
  observeGps({ getCurrentPosition() { assert.fail('GPS must not be acquired'); } }, () => assert.fail());
  assert.equal(dr.processGpsData(point(0), 1, Date.now()), false);
  const tracker = new NavigationProgressTracker();
  assert.equal(feed(tracker, 50, { source: 'gps', currentStep: 2 }).arrived, false);
});

test('invalid settings never replace a valid offline policy or enable GPS', async () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  await loadNavigationPolicy({ storage, fetcher: async () => ({ ok: true, json: async () => ({ policy: { ...defaults, warning_uncertainty_m: 25 } }) }) });
  await loadNavigationPolicy({ storage, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(getNavigationPolicy().warning_uncertainty_m, 25);
  await loadNavigationPolicy({ storage, fetcher: async () => ({ ok: true, json: async () => ({ policy: { gps_enabled: true } }) }) });
  assert.equal(getNavigationPolicy().gps_enabled, false);
  assert.equal(validNavigationPolicy({ ...defaults, snap_distance_m: 21 }), false);
  assert.equal(validNavigationPolicy({ ...defaults, arrival_samples: 2.5 }), false);
});

test('step-only navigation advances in sequence and arrives without a destination QR', () => {
  const tracker = new NavigationProgressTracker();
  let currentStep = 0, arrived = false;
  for (let m = 0.7; m <= 50; m += 0.7) {
    const result = feed(tracker, m, { currentStep });
    currentStep = result.nextStep;
    if (result.arrived) { arrived = true; break; }
  }
  assert.equal(currentStep, 2);
  assert.equal(arrived, true);
  assert.ok(tracker.routeDistance < 0.01);
});

test('a discrepancy above 20 m never blocks progress or uses reported accuracy', () => {
  const tracker = new NavigationProgressTracker();
  feed(tracker, 0.7, { accuracy: 80 });
  assert.ok(tracker.routeDistance < 0.01);
  assert.equal(feed(tracker, 1.4, { offset: 22 }).arrived, false);
  assert.ok(Math.abs(tracker.routeDistance - 22) < 0.01);
  assert.ok(Math.abs(tracker.along - 1.4) < 0.01);
  feed(tracker, 2.1, { offset: 22, source: 'gps' });
  assert.ok(Math.abs(tracker.along - 1.4) < 0.01);
  feed(tracker, 2.8, { offset: 22 });
  assert.ok(Math.abs(tracker.along - 2.8) < 0.01);
  feed(tracker, 3.5, { offset: 0 });
  assert.ok(tracker.routeDistance < 0.01);
});

test('a display marker reaching the end cannot declare arrival while the raw estimate is off route', () => {
  const tracker = new NavigationProgressTracker();
  let currentStep = 0;
  for (let m = 0.7; m <= 50; m += 0.7) {
    const result = feed(tracker, m, { offset: 22, currentStep });
    currentStep = result.nextStep;
    assert.equal(result.arrived, false);
  }
  assert.equal(tracker.snappedGeo.lng, 0);
  assert.ok(tracker.routeDistance > 20);
  assert.ok(tracker.routeM > 0.99);
});

test('the discrepancy projects onto the bounded section of a single long edge', () => {
  const tracker = new NavigationProgressTracker();
  feed(tracker, 0.7);
  feed(tracker, 45, { distanceSinceAnchor: 1.4 });
  assert.ok(Math.abs(tracker.routeDistance - 40.6) < 0.01);
  assert.ok(Math.abs(tracker.along - 1.4) < 0.01);
});

test('a close return leg cannot move the marker to the end of a hairpin route', () => {
  const tracker = new NavigationProgressTracker();
  const line = [[0, 0], [0, 100 / 111195], [2 / 111195, 100 / 111195], [2 / 111195, 0]];
  const result = tracker.update({ measurement: { ...point(1, 2), accuracy: 10, heading: 0,
    timestamp: 100000, positionTimestamp: 100000, distanceSinceAnchor: 1, source: 'dead_reckoning' },
    steps, currentStep: 0, coordinates: line, context: 'hairpin', now: 100000 });
  assert.equal(result.arrived, false);
  assert.ok(tracker.routeM < 0.02);
});

test('floor changes and duplicate samples never auto-confirm arrival', () => {
  const tracker = new NavigationProgressTracker();
  const measurement = { ...point(0.7), accuracy: 2, heading: 0, timestamp: 100000, distanceSinceAnchor: 0.7, source: 'dead_reckoning' };
  const input = { measurement, steps: [{ type: 'stepChangeFloor' }, ...steps], currentStep: 0,
    coordinates, context: 'floor', now: 100000 };
  for (let i = 0; i < 5; i++) assert.deepEqual(tracker.update(input), { nextStep: 0, arrived: false });
});

test('missing heading allows display progress but cannot update the raw distance or confirm arrival', () => {
  const tracker = new NavigationProgressTracker();
  feed(tracker, 0.7, { offset: 22 });
  const distance = tracker.routeDistance;
  const result = feed(tracker, 50, { currentStep: 2, heading: null, positionTimestamp: null });
  assert.equal(result.arrived, false);
  assert.ok(tracker.routeM > 0.99);
  assert.equal(tracker.routeDistance, distance);
});

test('DR keeps the raw path and detected walking distance independent without a drift coefficient', async t => {
  const saved = { window: globalThis.window, motion: globalThis.DeviceMotionEvent };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.DeviceMotionEvent = {};
  t.after(() => { dr.stop(); globalThis.window = saved.window; globalThis.DeviceMotionEvent = saved.motion; });
  await dr.start(point(0), { accuracy: 2 });
  dr.anchorTimestamp = Date.now() - 120000;
  for (let i = 0; i < 100; i++) {
    dr.heading = 0; dr._headingAt = Date.now(); dr._processStep();
  }
  assert.ok(dr.distanceSinceAnchor > 69);
  assert.equal(dr.positionAccuracy, 2);
  assert.ok(Number.isFinite(dr.positionTimestamp));
  const raw = dr.geoPosition;
  const walked = dr.distanceSinceAnchor;
  dr._headingAt = null;
  dr._processStep();
  assert.equal(dr.positionAccuracy, 2);
  assert.deepEqual(dr.geoPosition, raw);
  assert.ok(Math.abs(dr.distanceSinceAnchor - walked - 0.7) < 0.001);
  assert.ok(Number.isFinite(dr.stepTimestamp));
  assert.equal(dr.positionTimestamp, null);
});

test('a steady gyro stream carries a known compass direction briefly and stops after an unconfirmed turn', async t => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: Date.now() });
  const saved = { window: globalThis.window, motion: globalThis.DeviceMotionEvent };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.DeviceMotionEvent = {};
  t.after(() => { dr.stop(); globalThis.window = saved.window; globalThis.DeviceMotionEvent = saved.motion; });
  await dr.start(point(0), { accuracy: 5 });

  const motion = (alpha = 0) => {
    t.mock.timers.tick(100);
    dr.motionHandler({
      accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 },
      rotationRate: { alpha, beta: 0, gamma: 0 },
    });
  };
  motion();
  assert.equal(dr.getHeading(), null);
  dr.orientationHandler({ type: 'deviceorientationabsolute', alpha: 0 });
  for (let i = 0; i < 90; i++) motion();
  assert.equal(dr.getHeading(), 0);
  dr._processStep();
  assert.ok(dr.geoPosition.lat > 0);
  const lastPosition = dr.geoPosition;

  motion(90);
  motion(90);
  assert.equal(dr.getHeading(), null);
  dr._processStep();
  assert.deepEqual(dr.geoPosition, lastPosition);
  assert.equal(dr.positionTimestamp, null);

  dr.orientationHandler({ type: 'deviceorientationabsolute', alpha: 0 });
  for (let i = 0; i < 151; i++) motion();
  assert.equal(dr.getHeading(), null);
});
