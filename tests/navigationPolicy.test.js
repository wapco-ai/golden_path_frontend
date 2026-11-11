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
function feed(tracker, m, { currentStep = 0, accuracy = 2 + m * 0.3, heading = 0, offset = 0, ...extra } = {}) {
  const timestamp = 100000 + Math.round(m * 1000);
  return tracker.update({ measurement: { ...point(m, offset), accuracy, heading, timestamp,
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

test('step-only navigation advances in sequence and arrives without a destination QR at uncertainty above 6 m', () => {
  const tracker = new NavigationProgressTracker();
  let currentStep = 0, arrived = false;
  for (let m = 0.7; m <= 50; m += 0.7) {
    const result = feed(tracker, m, { currentStep });
    currentStep = result.nextStep;
    if (result.arrived) { arrived = true; break; }
  }
  assert.equal(currentStep, 2);
  assert.equal(arrived, true);
  assert.equal(tracker.warning, null);
});

test('exceeding 20 m latches the warning; GPS, rerenders and snapping cannot clear it', () => {
  const tracker = new NavigationProgressTracker();
  feed(tracker, 0.7);
  const original = tracker.routeM;
  assert.equal(feed(tracker, 1.4, { accuracy: 20.1 }).arrived, false);
  assert.equal(tracker.warning, 'uncertainty');
  feed(tracker, 2.1, { accuracy: 1, source: 'gps' });
  feed(tracker, 2.8, { accuracy: 1 });
  assert.equal(tracker.routeM, original);
  tracker.reset(); // A newly verified anchor may reset the budget.
  feed(tracker, 0.7);
  assert.equal(tracker.warning, null);
});

test('display snapping preserves raw uncertainty and cannot declare arrival from lateral discrepancy', () => {
  const tracker = new NavigationProgressTracker();
  let currentStep = 0;
  for (let m = 0.7; m <= 50; m += 0.7) {
    const result = feed(tracker, m, { offset: 10, currentStep, accuracy: 15 });
    currentStep = result.nextStep;
    assert.equal(result.arrived, false);
  }
  assert.equal(tracker.snappedGeo.lng, 0);
  assert.equal(tracker.warning, null);
});

test('large discrepancy and an impossible jump freeze progress instead of inventing a reroute', () => {
  const tracker = new NavigationProgressTracker();
  feed(tracker, 0.7);
  feed(tracker, 1.4, { offset: 21 });
  assert.equal(tracker.warning, 'off_route');
  assert.equal(tracker.blocked, true);
  tracker.reset();
  feed(tracker, 0.7);
  feed(tracker, 45, { distanceSinceAnchor: 1.4 });
  assert.equal(tracker.warning, 'off_route');
});

test('a close return leg cannot move the marker to the end of a hairpin route', () => {
  const tracker = new NavigationProgressTracker();
  const line = [[0, 0], [0, 100 / 111195], [2 / 111195, 100 / 111195], [2 / 111195, 0]];
  const result = tracker.update({ measurement: { ...point(1, 2), accuracy: 10, heading: 0,
    timestamp: 100000, distanceSinceAnchor: 1, source: 'dead_reckoning' },
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

test('wrong heading prevents automatic step progression', () => {
  const tracker = new NavigationProgressTracker();
  feed(tracker, 0.7, { heading: 180 });
  assert.equal(tracker.warning, 'heading');
  assert.equal(tracker.routeM, 0);
});

test('DR continues beyond 30 m and 60 seconds, grows uncertainty, and charges unobserved steps', async t => {
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
  assert.ok(dr.positionAccuracy > 20);
  assert.ok(Number.isFinite(dr.positionTimestamp));
  const error = dr.positionAccuracy;
  dr._headingAt = null;
  dr._processStep();
  assert.ok(dr.positionAccuracy > error);
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
