import test from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.sessionStorage = {
  getItem: (key) => storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear()
};

const {
  fetchRouteHistory,
  historyModeMessageId,
  historyModeToTransportMode,
  normalizeHistoryRoute
} = await import('../src/services/routeHistoryService.js');
const { requestRouting } = await import('../src/services/routingService.js');

test('route history mode mappings preserve existing UI message ids', () => {
  assert.equal(historyModeToTransportMode('walk'), 'walking');
  assert.equal(historyModeToTransportMode('wheelchair'), 'wheelchair');
  assert.equal(historyModeToTransportMode('van'), 'electric-car');
  assert.equal(historyModeMessageId('walk'), 'transportWalk');
  assert.equal(historyModeMessageId('wheelchair'), 'transportWheelchair');
  assert.equal(historyModeMessageId('van'), 'transportCar');
});

test('route history request uses the logged-in user bearer token', async () => {
  storage.clear();
  sessionStorage.setItem('gp_user_access_token', 'history-token');
  const originalFetch = globalThis.fetch;
  let captured;

  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      json: async () => ({ data: [{ id: 7 }] })
    };
  };

  try {
    const result = await fetchRouteHistory({ limit: 12 });
    assert.deepEqual(result, [{ id: 7 }]);
    assert.match(captured.url, /\/api\/v1\/users\/me\/route-history\?limit=12$/);
    assert.equal(captured.options.headers.Authorization, 'Bearer history-token');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('stored route snapshot is normalized through the same routing mapper', () => {
  const item = {
    mode: 'walk',
    gender: 'both',
    origin: { name: 'A', coordinates: [36.28, 59.61], floor: 0 },
    destination: { name: 'B', coordinates: [36.29, 59.62], floor: 0 },
    route: {
      geo: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[59.61, 36.28], [59.62, 36.29]] }
      },
      steps: [
        { type: 'stepStart', title: 'شروع', coord: { lat: 36.28, lon: 59.61 }, endCoord: { lat: 36.29, lon: 59.62 } }
      ],
      distanceMeters: 120,
      estimatedMinutes: 2
    }
  };

  const route = normalizeHistoryRoute(item);
  assert.equal(route.distanceMeters, 120);
  assert.equal(route.durationSeconds, 120);
  assert.equal(route.from, 'A');
  assert.equal(route.to, 'B');
  assert.deepEqual(route.geo, item.route.geo);
});

test('routing sends bearer token and endpoint names so successful routes can be captured in history', async () => {
  storage.clear();
  sessionStorage.setItem('gp_user_access_token', 'routing-token');
  sessionStorage.setItem('haramCurrentFloor', '0');
  const originalFetch = globalThis.fetch;
  let captured;

  globalThis.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({
        ok: true,
        mode: 'walk',
        gender: 'both',
        geo: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[59.61, 36.28], [59.62, 36.29]] }
        },
        steps: [],
        distanceMeters: 100,
        estimatedMinutes: 1.5
      })
    };
  };

  try {
    const route = await requestRouting({
      origin: { name: 'مبدا', coordinates: [36.28, 59.61], floor: 0 },
      destination: { name: 'مقصد', coordinates: [36.29, 59.62], floor: 0 },
      mode: 'walking',
      gender: 'both',
      lang: 'fa'
    });

    assert.equal(captured.options.headers.Authorization, 'Bearer routing-token');
    assert.equal(captured.body.origin.name, 'مبدا');
    assert.equal(captured.body.destination.name, 'مقصد');
    assert.equal(captured.body.origin.type, 'coordinate');
    assert.equal(captured.body.destination.type, 'coordinate');
    assert.equal(route.distanceMeters, 100);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
