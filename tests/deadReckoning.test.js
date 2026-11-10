import { DEFAULT_NAVIGATION_POLICY, setNavigationPolicy } from '../src/services/navigationPolicy.js';
setNavigationPolicy({ ...DEFAULT_NAVIGATION_POLICY, gps_enabled: true });
import test from 'node:test';
import assert from 'node:assert/strict';
import deadReckoning from '../src/services/AdvancedDeadReckoningService.js';

const initialPosition = { lat: 36.288, lng: 59.6157 };
const originalGlobals = {
  window: globalThis.window,
  DeviceMotionEvent: globalThis.DeviceMotionEvent,
  DeviceOrientationEvent: globalThis.DeviceOrientationEvent
};

const setupSensors = ({
  requestMotion = () => Promise.resolve('granted'),
  requestOrientation = () => Promise.resolve('granted'),
  hasOrientation = true
} = {}) => {
  const handlers = new Map();
  globalThis.window = {
    screen: { orientation: { angle: 0 } },
    addEventListener(type, handler) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      handlers.get(type)?.delete(handler);
    }
  };
  globalThis.DeviceMotionEvent = { requestPermission: requestMotion };
  if (hasOrientation) {
    globalThis.DeviceOrientationEvent = { requestPermission: requestOrientation };
  } else {
    delete globalThis.DeviceOrientationEvent;
  }
  return {
    listeners: (type) => handlers.get(type)?.size ?? 0,
    emit(type, event) {
      for (const handler of handlers.get(type) ?? []) handler({ type, ...event });
    }
  };
};

test.afterEach(() => {
  deadReckoning.stop();
  for (const [name, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[name];
    else globalThis[name] = value;
  }
});

const simulateWalk = (sensors, values, cycles = 6, linear = false) => {
  let timeStamp = 1000;
  for (let i = 0; i < cycles; i += 1) {
    for (const value of values) {
      sensors.emit('devicemotion', {
        timeStamp,
        accelerationIncludingGravity: linear ? null : { x: 0, y: 0, z: value },
        acceleration: linear ? { x: value, y: 0, z: 0 } : null
      });
      timeStamp += 50;
    }
  }
};

test('regular walking updates coordinates and the location event', async () => {
  const sensors = setupSensors();
  const events = [];
  const remove = deadReckoning.addListener(event => events.push(event));
  try {
    await deadReckoning.start(initialPosition);
    sensors.emit('deviceorientationabsolute', { absolute: true, alpha: 270 });
    simulateWalk(sensors, [9.8, 9.8, 10.5, 12.4, 13, 11, 9.6, 9.2, 9.7, 9.8, 9.8, 9.8]);
    assert.ok(deadReckoning.stepCount >= 4, 'normal steps must not disappear behind smoothing');
    assert.ok(deadReckoning.geoPosition.lng > initialPosition.lng);
    assert.ok(events.some(event => event.type === 'stepDetected' && event.geoPosition.lng > initialPosition.lng));
  } finally {
    remove();
  }
});

test('stationary acceleration noise does not move the marker', async () => {
  const sensors = setupSensors();
  await deadReckoning.start(initialPosition);
  simulateWalk(sensors, [9.8, 9.9, 9.7, 9.83, 9.8, 9.81], 10);
  assert.equal(deadReckoning.stepCount, 0);
  assert.deepEqual(deadReckoning.geoPosition, initialPosition);
});

test('devices offering only gravity-free acceleration can detect steps', async () => {
  const sensors = setupSensors({ hasOrientation: false });
  await deadReckoning.start(initialPosition);
  assert.equal(sensors.listeners('devicemotion'), 1);
  simulateWalk(sensors, [0.05, 0.15, 0.6, 1.7, 2.2, 1.1, 0.25, 0.1, 0.05, 0.05, 0.05, 0.05], 5, true);
  assert.ok(deadReckoning.stepCount >= 3);
  assert.deepEqual(deadReckoning.geoPosition, initialPosition, 'steps without compass cannot establish a position');
});

test('both iOS sensor permission prompts start within the same gesture', async () => {
  const calls = [];
  let grantMotion;
  const sensors = setupSensors({
    requestMotion: () => {
      calls.push('motion');
      return new Promise(resolve => { grantMotion = resolve; });
    },
    requestOrientation: () => {
      calls.push('orientation');
      return Promise.resolve('granted');
    }
  });
  const pending = deadReckoning.start(initialPosition);
  assert.deepEqual(calls, ['motion', 'orientation']);
  grantMotion('granted');
  await pending;
  assert.equal(sensors.listeners('devicemotion'), 1);
  assert.equal(sensors.listeners('deviceorientation'), 1);
});

test('orientation denial cannot disable walking detection', async () => {
  const sensors = setupSensors({ requestOrientation: () => Promise.resolve('denied') });
  await deadReckoning.start(initialPosition);
  assert.equal(deadReckoning.isActive, true);
  assert.equal(sensors.listeners('devicemotion'), 1);
  assert.equal(sensors.listeners('deviceorientation'), 0);
  simulateWalk(sensors, [9.8, 9.8, 10.5, 12.4, 13, 11, 9.6, 9.2, 9.7, 9.8, 9.8, 9.8], 5);
  assert.ok(deadReckoning.stepCount > 0);
});

test('denied motion permission reports inactive instead of a false active marker', async () => {
  const sensors = setupSensors({ requestMotion: () => Promise.resolve('denied') });
  await deadReckoning.start(initialPosition);
  assert.equal(deadReckoning.isActive, false);
  assert.equal(sensors.listeners('devicemotion'), 0);
});

test('stopping during permission prompt never installs stale listeners', async () => {
  let grantMotion;
  const sensors = setupSensors({
    requestMotion: () => new Promise(resolve => { grantMotion = resolve; })
  });
  const pending = deadReckoning.start(initialPosition);
  deadReckoning.stop();
  grantMotion('granted');
  await pending;
  assert.equal(deadReckoning.isActive, false);
  assert.equal(sensors.listeners('devicemotion'), 0);
});

test('missing, stale, relative and previous-session headings cannot create a northward position', async () => {
  const sensors = setupSensors();
  await deadReckoning.start(initialPosition);
  const walking = [9.8, 9.8, 10.5, 12.4, 13, 11, 9.6, 9.2, 9.7, 9.8, 9.8, 9.8];
  sensors.emit('deviceorientation', { absolute: false, alpha: 0 });
  simulateWalk(sensors, walking);
  assert.deepEqual(deadReckoning.geoPosition, initialPosition);
  assert.equal(deadReckoning.positionTimestamp, null);
  sensors.emit('deviceorientationabsolute', { alpha: 270 });
  deadReckoning._headingAt = Date.now() - 6000;
  deadReckoning._processStep();
  assert.deepEqual(deadReckoning.geoPosition, initialPosition);
  sensors.emit('deviceorientationabsolute', { alpha: 270 });
  await deadReckoning.start(initialPosition);
  deadReckoning._processStep();
  assert.equal(deadReckoning.heading, null);
  assert.deepEqual(deadReckoning.geoPosition, initialPosition);
});

test('GPS at 8–25 m can initialize an unanchored DR; invalid and stale fixes cannot move it', async () => {
  setupSensors();
  await deadReckoning.start(initialPosition, { trusted: false });
  const fix = { lat: 36.289, lng: 59.617 };
  const now = Date.now();
  deadReckoning.processGpsData(fix, 25, now);
  assert.deepEqual(deadReckoning.geoPosition, fix);
  for (const [position, accuracy, timestamp] of [
    [initialPosition, 26, now], [initialPosition, -1, now],
    [initialPosition, 5, now - 16000], [initialPosition, 5, now + 60000],
    [{ lat: NaN, lng: 59 }, 5, now], [{ lat: 100, lng: 59 }, 5, now]
  ]) {
    deadReckoning.processGpsData(position, accuracy, timestamp);
    assert.deepEqual(deadReckoning.geoPosition, fix);
  }
});

test('a browser exposing sensor APIs but delivering no data cannot stay falsely active', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: Date.now() });
  const sensors = setupSensors();
  await deadReckoning.start(initialPosition);
  t.mock.timers.tick(5001);
  assert.equal(deadReckoning.isActive, false);
  assert.equal(sensors.listeners('devicemotion'), 0);
  assert.equal(deadReckoning.positionTimestamp, null);
});

test('a recent GPS reading delivered after a step still corrects drift', async () => {
  const sensors = setupSensors();
  await deadReckoning.start(initialPosition);
  sensors.emit('deviceorientationabsolute', { alpha: 270 });
  deadReckoning._processStep();
  const fix = { lat: initialPosition.lat, lng: initialPosition.lng + 0.00001 };
  deadReckoning.processGpsData(fix, 3, Date.now() - 1000);
  assert.deepEqual(deadReckoning.geoPosition, fix);
  deadReckoning.processGpsData(initialPosition, 5, Date.now() - 3000);
  assert.deepEqual(deadReckoning.geoPosition, fix, 'out-of-order GPS is ignored');
});
