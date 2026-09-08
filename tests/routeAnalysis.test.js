import assert from 'assert';
import fs from 'fs';

// Use the installed dependency. Tests must never replace node_modules with stubs:
// doing so breaks subsequent Vite builds and any running local development server.
const { computeShortestPath, analyzeRoute, genderAllowed } = await import('../src/utils/routeAnalysis.js');

const geo = JSON.parse(fs.readFileSync(new URL('./sample.geojson', import.meta.url)));

const origin = { coordinates: [-0.00005, 0] };
const destination = { coordinates: [0.00025, 0] };

const { path: computedPath } = computeShortestPath(origin, destination, geo.features);

assert.strictEqual(computedPath[0][0], origin.coordinates[0]);
assert.strictEqual(computedPath[computedPath.length - 1][0], destination.coordinates[0]);
assert.ok(computedPath.length >= 3, 'path should include intermediate nodes');

console.log('computeShortestPath test passed');

// Tests for analyzeRoute service filtering
const origin2 = { coordinates: [0, -0.00005] };
const destination2 = { coordinates: [0, 0.00025] };

const walking = analyzeRoute(origin2, destination2, geo, 'walking', 'male');
const wheelchair = analyzeRoute(origin2, destination2, geo, 'wheelchair', 'male');

const containsConnection = route => {
  const hasConnection = steps => Array.isArray(steps) &&
    steps.some(step => step.type === 'stepPassConnection');
  if (!route) return false;
  if (hasConnection(route.steps)) return true;
  return Array.isArray(route.alternatives) &&
    route.alternatives.some(alt => hasConnection(alt.steps));
};

assert.strictEqual(
  containsConnection(walking),
  false,
  'walking alternatives should not include connection'
);
assert.strictEqual(
  containsConnection(wheelchair),
  false,
  'wheelchair alternatives should not include connection'
);

// Same dataset but using "electricVan" service key
const geoVan = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { nodeFunction: 'door', name: 'A', services: { walking: true, electricVan: true, wheelchair: true } } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [0.0001, 0] }, properties: { nodeFunction: 'connection', name: 'X', services: { walking: false, electricVan: true, wheelchair: false } } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [0.0002, 0] }, properties: { nodeFunction: 'door', name: 'D', services: { walking: true, electricVan: true, wheelchair: true } } }
  ]
};

const carVan = analyzeRoute(origin2, destination2, geoVan, 'electric-car');

assert.ok(
  Array.isArray(carVan?.steps) && carVan.steps.length > 0,
  'electric-car with electricVan key should produce a valid route'
);

// Gender filtering test using sample geojson connection (male only)
const female = analyzeRoute(origin2, destination2, geo, 'walking', 'female');

assert.strictEqual(
  containsConnection(female),
  false,
  'female routes should not include male-only connection'
);

assert.strictEqual(
  genderAllowed('male', 'male'),
  true,
  'male selection should allow male-only segments'
);
assert.strictEqual(
  genderAllowed('male', 'female'),
  false,
  'female selection should reject male-only segments'
);
assert.strictEqual(
  genderAllowed('male', 'family'),
  false,
  'family selection should reject male-only segments'
);

assert.strictEqual(
  genderAllowed('female', 'female'),
  true,
  'female selection should allow female-only segments'
);
assert.strictEqual(
  genderAllowed('female', 'male'),
  false,
  'male selection should reject female-only segments'
);
assert.strictEqual(
  genderAllowed('female', 'family'),
  false,
  'family selection should reject female-only segments'
);

assert.strictEqual(
  genderAllowed('family', 'family'),
  true,
  'family selection should allow family segments'
);
assert.strictEqual(
  genderAllowed('family', 'male'),
  true,
  'male selection should allow family segments'
);
assert.strictEqual(
  genderAllowed('family', 'female'),
  true,
  'family selection should allow family segments'
);

assert.strictEqual(
  genderAllowed('male,family', 'family'),
  true,
  'family selection should allow mixed segments containing the family tag'
);
assert.strictEqual(
  genderAllowed(['female', 'family'], 'male'),
  true,
  'family selection should allow segments tagged with family alongside other genders'
);

console.log('analyzeRoute service filtering tests passed');

// Complex routing test using multiple intermediate nodes
const geoComplex = JSON.parse(fs.readFileSync(new URL('./complex.geojson', import.meta.url)));
const origin3 = { coordinates: [0, 0] };
const destination3 = { coordinates: [0.0004, 0.0004] };
const complexRoute = analyzeRoute(origin3, destination3, geoComplex, 'walking', 'family');

assert.ok(complexRoute.path.length >= 4, 'route should include intermediate nodes');

const totalDistance = complexRoute.path.reduce((acc, cur, idx) => {
  if (idx === 0) return acc;
  const prev = complexRoute.path[idx - 1];
  return acc + Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
}, 0);

assert.ok(totalDistance < 0.00075, 'A* should find optimal diagonal path');

console.log('complex route test passed');

// Predefined drawn route should be selected when start/end match
const geoPredefined = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { nodeFunction: 'door', name: 'Start Door', services: { walking: true }, gender: 'family' } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [0.0002, 0.0002] }, properties: { nodeFunction: 'door', name: 'End Door', services: { walking: true }, gender: 'family' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [0.0001, 0.0001], [0.0002, 0.0002]] }, properties: { services: { walking: true }, gender: 'family' } }
  ]
};

const origin4 = { coordinates: [0, 0], name: 'Start Door' };
const destination4 = { coordinates: [0.0002, 0.0002], name: 'End Door' };
const predefinedRoute = analyzeRoute(origin4, destination4, geoPredefined, 'walking', 'family');

assert.deepStrictEqual(
  predefinedRoute.geo.geometry.coordinates,
  [[0, 0], [0.0001, 0.0001], [0.0002, 0.0002]]
);

assert.strictEqual(
  predefinedRoute.steps[predefinedRoute.steps.length - 1].type,
  'stepArriveDestination'
);

assert.strictEqual(predefinedRoute.alternatives.length, 0);

console.log('predefined geojson route test passed');
