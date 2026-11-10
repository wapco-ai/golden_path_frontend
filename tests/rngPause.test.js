import { DEFAULT_NAVIGATION_POLICY, setNavigationPolicy } from '../src/services/navigationPolicy.js';
setNavigationPolicy({ ...DEFAULT_NAVIGATION_POLICY, gps_enabled: true });
import test from 'node:test';
import assert from 'node:assert/strict';
import { getResumePosition, pauseRouteKey, readPausedNavigation, savePausedNavigation, resumeStepAt } from '../src/utils/rngPause.js';

const coordinates = [[59.615, 36.287], [59.615, 36.288], [59.615, 36.289]];
const steps = [{ fromM: 0, coordinates: coordinates.slice(0, 2) },
  { fromM: 0.5, coordinates: coordinates.slice(1) }];

test('resume follows the measured position forward or backward, and rejects off-route positions', () => {
  assert.equal(resumeStepAt({ lat: 36.2884, lng: 59.615 }, steps, 0, coordinates), 1);
  assert.equal(resumeStepAt({ lat: 36.2872, lng: 59.615 }, steps, 1, coordinates), 0);
  assert.equal(resumeStepAt({ lat: 36.2884, lng: 59.617 }, steps, 0, coordinates), null);
});

test('resume never skips a floor-change confirmation', () => {
  const floorSteps = [...steps, { type: 'stepChangeFloor', fromM: 1, segmentId: 1,
    coordinates: [coordinates.at(-1)], toFloor: 1 }];
  assert.equal(resumeStepAt({ lat: 36.289, lng: 59.615 }, floorSteps, 2, coordinates), 2);
});

test('a pause is restored only for its route, destination and travel preferences', () => {
  const values = new Map();
  globalThis.sessionStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key) };
  const key = pauseRouteKey(coordinates, { id: 42 }, 'walking', 'female');
  const pause = { key, step: 1, frame: { geo: { lat: 36.288, lng: 59.615 } } };
  savePausedNavigation(pause);
  assert.deepEqual(readPausedNavigation(key), pause);
  assert.equal(readPausedNavigation(pauseRouteKey(coordinates, { id: 43 }, 'walking', 'female')), null);
  assert.equal(readPausedNavigation(pauseRouteKey(coordinates, { id: 42 }, 'wheelchair', 'female')), null);
  savePausedNavigation(null);
  assert.equal(readPausedNavigation(key), null);
  delete globalThis.sessionStorage;
});

test('fresh GPS is required and requested without accepting cached measurements', async () => {
  const controller = new AbortController();
  const fakeGps = (age = 0, accuracy = 5) => ({ getCurrentPosition(success, _error, options) {
    assert.equal(options.maximumAge, 0);
    assert.equal(options.timeout, 10000);
    success({ timestamp: Date.now() - age, coords: { latitude: 36.288, longitude: 59.615, accuracy } });
  } });
  assert.equal((await getResumePosition(controller.signal, fakeGps())).lat, 36.288);
  await assert.rejects(getResumePosition(controller.signal, fakeGps(60000)), /location/);
  await assert.rejects(getResumePosition(controller.signal, fakeGps(0, 60)), /location/);
  await assert.rejects(getResumePosition(controller.signal, null), /location/);
});

test('abort cancels a pending position and ignores its later callback', async () => {
  const controller = new AbortController();
  let success;
  const pending = getResumePosition(controller.signal, { getCurrentPosition(callback) { success = callback; } });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  success({ timestamp: Date.now(), coords: { latitude: 36.288, longitude: 59.615, accuracy: 5 } });
});

test('unresponsive position provider times out instead of leaving resume permanently busy', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = getResumePosition(new AbortController().signal, { getCurrentPosition() {} });
  const rejected = assert.rejects(pending, /location/);
  t.mock.timers.tick(11000);
  await rejected;
});
