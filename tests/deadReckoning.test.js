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
  assert.ok(deadReckoning.geoPosition.lat > initialPosition.lat);
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
