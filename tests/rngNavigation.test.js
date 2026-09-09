import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRouteMSegments, sliceLineByFraction } from '../src/utils/routeSegments.js';
import {
  getStepStartRouteM, getNavigationProgress, getStepPreview,
  nextDemoStep, resolveNavigationFrame
} from '../src/utils/rngNavigation.js';
import { startGuidanceImagePolling } from '../src/services/guidanceImagePolling.js';
import { fetchLandmarkViewImage } from '../src/services/landmarkViewImageService.js';

const route = [[59.61, 36.28], [59.611, 36.28], [59.611, 36.282]];
const steps = buildRouteMSegments([
  { routeM: 0, type: 'stepStart' },
  { routeM: 0.3, type: 'stepPassDoor' },
  { routeM: 1, type: 'stepArrive' }
], route);
const pointAt = (m) => {
  const [lng, lat] = sliceLineByFraction(route, m, m)[0];
  return { lat, lng };
};
const frame = (extra = {}) => resolveNavigationFrame({
  step: steps[0], stepIndex: 0, routeCoordinates: route,
  userLocation: [10, 20], userHeading: 180, sessionFloor: 0, ...extra
});

test('segment fromM wins over endpoint routeM and no null-to-zero coercion', () => {
  assert.equal(getStepStartRouteM({ fromM: 0.3, routeM: 1 }, route), 0.3);
  assert.equal(getStepStartRouteM({ fromM: '0.3' }, route), 0.3);
  assert.equal(getStepStartRouteM({ fromM: null, routeM: null }, route), null);
  assert.equal(getStepStartRouteM({ fromM: 0 }, route), 0);
});

test('both expanded and collapsed panel previews use the selected step', () => {
  for (const stepIndex of [0, 1]) {
    const a = frame({ step: steps[stepIndex], stepIndex, isInfoModalOpen: true });
    const b = frame({ step: steps[stepIndex], stepIndex, isInfoModalOpen: false });
    assert.deepEqual(a, b);
    assert.deepEqual(a.geo, getStepPreview(steps[stepIndex], route, stepIndex).geo);
    assert.equal(a.mode, 'preview');
    assert.notEqual(a.heading, 180);
  }
});

test('real movement uses changing DR position, not fixed step origin', () => {
  const first = frame({ isRoutingActive: true, isDrActive: true, drPosition: pointAt(0.1) });
  const second = frame({ isRoutingActive: true, isDrActive: true, drPosition: pointAt(0.2) });
  assert.deepEqual(second.geo, pointAt(0.2));
  assert.notDeepEqual(first.geo, second.geo);
  assert.equal(first.heading, second.heading);
  assert.equal(second.mode, 'live');
});

test('live GPS is used when a valid DR position is unavailable', () => {
  const f = frame({ isRoutingActive: true, isDrActive: true, drPosition: null });
  assert.deepEqual(f.geo, { lat: 10, lng: 20 });
});

test('demo isolates the selected frame from GPS and active DR', () => {
  const extra = { isDemoMode: true, isRoutingActive: true, isDrActive: true, drPosition: pointAt(0.9) };
  const result = frame(extra);
  assert.deepEqual(result.geo, getStepPreview(steps[0], route, 0).geo);
  assert.equal(result.mode, 'demo');
});

test('demo can advance to last step, wrap, and preview a single step', () => {
  assert.equal(nextDemoStep(0, 2), 1);
  assert.equal(nextDemoStep(1, 2), 0);
  assert.equal(nextDemoStep(0, 1), 0);
  assert.equal(nextDemoStep(0, 0), 0);
});

test('unequal two-step route advances at 30%, not the route endpoint', () => {
  assert.equal(steps.length, 2);
  assert.equal(getNavigationProgress(pointAt(0.1), steps, 0, route).nextStep, 0);
  assert.equal(getNavigationProgress(pointAt(0.35), steps, 0, route).nextStep, 1);
});

test('a point far away from the route cannot advance the step', () => {
  assert.equal(getNavigationProgress({ lat: 37, lng: 60 }, steps, 0, route).nextStep, 0);
});

test('the final segment remains active until arrival at the endpoint', () => {
  assert.equal(getNavigationProgress(pointAt(0.8), steps, 1, route).arrived, false);
  assert.equal(getNavigationProgress(pointAt(1), steps, 1, route).arrived, true);
  const result = frame({ step: steps[1], stepIndex: 1, hasArrived: true });
  assert.deepEqual(result.geo, pointAt(1));
  assert.equal(result.routeM, 1);
});

test('floor is preserved including floor zero and negative floors', () => {
  assert.equal(frame({ step: { ...steps[0], floor: -1 } }).floor, -1);
  assert.equal(frame({ step: { ...steps[0], floor: 0 }, sessionFloor: -1 }).floor, 0);
  assert.equal(frame({ step: { ...steps[0], floor: null }, sessionFloor: -1 }).floor, -1);
});

test('navigation calculations do not modify the route or its geometry', () => {
  const before = JSON.stringify({ route, steps });
  frame({ step: steps[1], stepIndex: 1 });
  getNavigationProgress(pointAt(0.4), steps, 0, route);
  assert.equal(JSON.stringify({ route, steps }), before);
});

test('degenerate step heading is not fabricated as north', () => {
  const step = { coordinates: [[59, 36], [59, 36]] };
  assert.equal(getStepPreview(step, route).heading, null);
});

const input = { geo: { lat: 36.28, lng: 59.61 }, heading: 90, floor: 0, source: 'guidance_points' };

test('image service requests guidance-only and normalizes the image URL', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(new URL(url).searchParams.get('source'), 'guidance_points');
    return { ok: true, json: async () => ({ source: 'guidance_points', image: { url: '/storage/a.jpg' } }) };
  });
  const data = await fetchLandmarkViewImage(input);
  assert.equal(data.image.url, 'http://localhost:8080/storage/a.jpg');
});

test('a source-unaware old backend cannot silently display a POI image', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ poi_id: 22, image: { url: '/poi.jpg' } }) }));
  await assert.rejects(fetchLandmarkViewImage(input), /Update the backend first/);
});

test('guidance NO_MATCH is valid and auto consumers keep their existing behavior', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    json: async () => new URL(url).searchParams.has('source')
      ? { source: 'guidance_points', status: 'NO_MATCH', image: null }
      : { poi_id: 22, image: { url: '/poi.jpg' } }
  }));
  assert.equal((await fetchLandmarkViewImage(input)).image, null);
  assert.equal((await fetchLandmarkViewImage({ ...input, source: 'auto' })).poi_id, 22);
});

const flush = async () => { for (let i = 0; i < 4; i += 1) await Promise.resolve(); };
const fakeClock = () => {
  let id = 0;
  const timers = new Map();
  return {
    timers,
    schedule: (callback, ms) => { timers.set(++id, { callback, ms }); return id; },
    cancel: (key) => timers.delete(key),
    fire: (ms) => {
      const [key, task] = [...timers.entries()].find(([, value]) => value.ms === ms);
      timers.delete(key); task.callback();
    }
  };
};

test('polling reads latest location without overlaps or sensor-triggered aborts', async () => {
  const clock = fakeClock();
  const calls = [];
  const results = [];
  let current = input;
  let resolve;
  const stop = startGuidanceImagePolling({
    ...clock, readRequest: () => current,
    fetchImage: (request) => { calls.push(request); return new Promise((done) => { resolve = done; }); },
    onResult: (data) => results.push(data), onError: assert.fail, onLoading: () => {},
  });
  current = { ...input, geo: { lat: 36.281, lng: 59.612 } };
  assert.equal(calls.length, 1);
  assert.equal(calls[0].signal.aborted, false);
  resolve({ source: 'guidance_points', image: null }); await flush();
  clock.fire(1500);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].geo, current.geo);
  stop();
  assert.equal(calls[1].signal.aborted, true);
  resolve({ image: 'stale response' }); await flush();
  assert.equal(results.length, 1);
  assert.equal(clock.timers.size, 0);
});

test('request failure clears through onError and polling can recover', async () => {
  const clock = fakeClock();
  const errors = [];
  let attempts = 0;
  const results = [];
  const stop = startGuidanceImagePolling({
    ...clock, readRequest: () => input,
    fetchImage: async () => { if (++attempts === 1) throw new Error('offline'); return { image: null }; },
    onError: (error) => errors.push(error.message), onResult: (data) => results.push(data), onLoading: () => {},
  });
  await flush(); assert.deepEqual(errors, ['offline']);
  clock.fire(1500); await flush();
  assert.equal(results.length, 1);
  stop();
});

// Read the actual RNG call site: service defaults alone did not catch the
// page's explicit 45-degree override. No database or live network is used.
const rngImageOptions = () => {
  const source = readFileSync(new URL('../src/pages/Routing.jsx', import.meta.url), 'utf8');
  const call = source.match(/useGuidanceImage\(\{([\s\S]*?)\}, guidanceContextKey\)/);
  assert.ok(call, 'The RNG image request must be wired to the shared navigation frame');
  assert.match(call[1], /geo: navigationFrame\.geo/);
  assert.match(call[1], /heading: effectiveHeading/);
  assert.match(call[1], /floor: navigationFrame\.floor/);
  const fov = call[1].match(/\bfov:\s*(\d+)/);
  const maxDistance = call[1].match(/\bmaxDistance:\s*(\d+)/);
  assert.ok(fov && maxDistance);
  return { fov: Number(fov[1]), maxDistance: Number(maxDistance[1]) };
};

test('RNG uses a 60-degree request FOV for the reported diagonal-heading case', () => {
  const options = rngImageOptions();
  assert.deepEqual(options, { fov: 60, maxDistance: 250 });
  const imageFov = 60;
  const difference = Math.abs(90 - 62.318348205083794);
  assert.ok(difference > Math.min(imageFov, 45) / 2);
  assert.ok(difference <= Math.min(imageFov, options.fov) / 2);
});

test('RNG FOV reaches the image request without changing position, heading or source', async (t) => {
  const heading = 62.318348205083794;
  const options = rngImageOptions();
  t.mock.method(globalThis, 'fetch', async (url) => {
    const params = new URL(url).searchParams;
    assert.equal(params.get('fov'), '60');
    assert.equal(params.get('max_distance'), '250');
    assert.equal(params.get('source'), 'guidance_points');
    assert.equal(Number(params.get('heading')), heading);
    assert.equal(Number(params.get('geo[lat]')), input.geo.lat);
    assert.equal(Number(params.get('geo[lng]')), input.geo.lng);
    assert.equal(params.get('floor'), '0');
    return { ok: true, json: async () => ({
      status: 'OK', source: 'guidance_points',
      image: { id: 31, url: '/storage/test-guidance.jpg' }
    }) };
  });
  const result = await fetchLandmarkViewImage({ ...input, ...options, heading });
  assert.equal(result.image.id, 31);
  assert.equal(result.status, 'OK');
});
