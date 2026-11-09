import test from 'node:test';
import assert from 'node:assert/strict';
import { AxiosError } from 'axios';
import apiUser from '../src/api/apiUser.js';
import { useUserAuthStore } from '../src/auth/user/userAuthStore.js';
import { fetchRouteHistory } from '../src/services/routeHistoryService.js';
import { submitEmergency } from '../src/services/emergencyService.js';
import { submitUserFeedback } from '../src/services/userFeedbackService.js';
import { listDestinations } from '../src/services/destinationService.js';
import { getLiveNavigationGeo, resolveNavigationFrame } from '../src/utils/rngNavigation.js';
import { placesToFeatures } from '../src/utils/placeFeatures.js';
import { readNotifications, writeNotifications } from '../src/services/userNotificationService.js';
import { fetchLanguages } from '../src/services/languageService.js';
import { fetchLandmarkPlaces } from '../src/services/landmarkService.js';

const adapter = apiUser.defaults.adapter;
const refresh = useUserAuthStore.getState().refreshSession;
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
test.afterEach(() => {
  apiUser.defaults.adapter = adapter;
  useUserAuthStore.setState({ refreshSession: refresh });
  useUserAuthStore.getState().clearSession();
  storage.clear();
});

test('persisted login works without sessionStorage and concurrent 401s share one refresh', async () => {
  useUserAuthStore.getState().setSession({ accessToken: 'expired', refreshToken: 'refresh', user: { id: 42 } });
  let refreshes = 0;
  useUserAuthStore.setState({ refreshSession: async () => {
    refreshes++;
    await new Promise(resolve => setTimeout(resolve, 5));
    useUserAuthStore.getState().setSession({ accessToken: 'renewed', refreshToken: 'new-refresh', user: { id: 42 } }, { fromRefresh: true });
  } });
  apiUser.defaults.adapter = async config => {
    if (config.headers.Authorization !== 'Bearer renewed') {
      throw new AxiosError('expired', 'ERR_BAD_REQUEST', config, null, { status: 401, data: {} });
    }
    return { config, status: 200, data: config.url.includes('route-history') ? { data: [{ id: 1 }] } : { items: [{ id: 2 }] } };
  };
  const [history, destinations] = await Promise.all([fetchRouteHistory(), listDestinations()]);
  assert.deepEqual(history, [{ id: 1 }]);
  assert.deepEqual(destinations.items, [{ id: 2 }]);
  assert.equal(refreshes, 1);
});

test('guest feedback has no fabricated bearer identity and an unrated comment sends null', async () => {
  apiUser.defaults.adapter = async config => {
    assert.equal(config.headers.Authorization, undefined);
    assert.equal(JSON.parse(config.data).rating, null);
    return { status: 201, config, data: { id: 5, status: 'pending' } };
  };
  assert.equal((await submitUserFeedback({ targetId: 2, body: 'comment', lang: 'fa' })).id, 5);
});

test('emergency needs a matching durable receipt; notification is real, scoped and read state persists', async () => {
  useUserAuthStore.getState().setSession({ accessToken: 'valid', user: { id: 42 } });
  const payload = { requestId: 'request-1', type: 'medical', description: 'test', location: null };
  apiUser.defaults.adapter = async config => ({ status: 200, config, data: {} });
  await assert.rejects(submitEmergency(payload));
  assert.equal(readNotifications(42).length, 0);
  apiUser.defaults.adapter = async config => ({ status: 201, config, data: { id: 7, status: 'received', requestId: payload.requestId } });
  await submitEmergency(payload);
  await submitEmergency(payload);
  assert.equal(readNotifications(42).length, 1);
  assert.equal(readNotifications(43).length, 0);
  writeNotifications(42, readNotifications(42).map(n => ({ ...n, read: true })));
  assert.equal(readNotifications(42)[0].read, true);
});

test('stale DR yields to fresh GPS and unmeasured defaults cannot advance a route', () => {
  const now = Date.now();
  const inputs = { isDrActive: true, drPosition: { lat: 1, lng: 2 }, userLocation: [3, 4], now };
  assert.deepEqual(getLiveNavigationGeo({ ...inputs, drTimestamp: null, gpsTimestamp: now }), { lat: 3, lng: 4 });
  assert.equal(getLiveNavigationGeo({ ...inputs, drTimestamp: now - 16000, gpsTimestamp: null }), null);
});

test('signal loss freezes the measured marker without claiming a fresh location', () => {
  const now = Date.now();
  const inputs = { isRoutingActive: true, userLocation: [36.288, 59.616],
    drTimestamp: null, gpsTimestamp: now - 60000, now,
    routeCoordinates: [[59.615, 36.287], [59.617, 36.289]],
    step: { coordinates: [[59.615, 36.287], [59.617, 36.289]] } };
  assert.equal(getLiveNavigationGeo(inputs), null);
  assert.deepEqual(resolveNavigationFrame(inputs).geo, { lat: 36.288, lng: 59.616 });
});

test('place search uses actual POI coordinates and filters floors and invalid coordinates', () => {
  const data = placesToFeatures([
    { id: 1, title: 'Place', lat: 36.28, lng: 59.61, floor: 1 },
    { id: 2, title: 'Other floor', lat: 36.28, lng: 59.61, floor: 0 },
    { id: 3, title: 'Invalid', floor: 1 }
  ], 1);
  assert.equal(data.features.length, 1);
  assert.equal(data.features[0].properties.name, 'Place');
  assert.deepEqual(data.features[0].geometry.coordinates, [59.61, 36.28]);
});

test('language outage retains access with bundled translations', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try { assert.deepEqual((await fetchLanguages()).data.map(l => l.code), ['fa', 'en', 'ar', 'ur']); }
  finally { globalThis.fetch = originalFetch; }
});

test('an aborted POI search cannot cancel the next floor search', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (_url, { signal }) => {
    calls += 1;
    if (calls === 1) return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    return Promise.resolve({ ok: true, json: async () => ({ places: { landmarkPlaces: [{ id: 99, floor: 1 }] } }) });
  };
  try {
    const first = new AbortController();
    const pending = fetchLandmarkPlaces({ search: 'distinct-abort-test', signal: first.signal });
    first.abort();
    const second = fetchLandmarkPlaces({ search: 'distinct-abort-test', signal: new AbortController().signal });
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal((await second).places.landmarkPlaces[0].id, 99);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});
