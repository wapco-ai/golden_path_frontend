import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_GUIDANCE_COVERAGE_RADIUS_M, coverageRadiusForForm, parseCoverageRadius } from '../src/utils/guidanceCoverage.js';

const source = readFileSync(new URL('../src/AdminPanel/Marks.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('new guidance points default to 100 metres', () => {
  assert.equal(DEFAULT_GUIDANCE_COVERAGE_RADIUS_M, 100);
  assert.equal(coverageRadiusForForm(undefined), 100);
  assert.equal(coverageRadiusForForm(null), 100);
});

test('opening an existing point preserves its saved radius rather than overwriting it', () => {
  for (const radius of [10, '10.00', 25.5, 100, '']) {
    assert.equal(coverageRadiusForForm(radius), radius);
  }
  assert.match(source, /coverageRadiusForForm\(mark\.coverage_radius_m\)/);
});

test('radius validation accepts the full supported range including exactly 100', () => {
  for (const value of [0.01, '.25', '0.50', 10, '33.53', '100.00', 100]) {
    assert.equal(parseCoverageRadius(value), Number(value));
  }
});

test('blank, nonnumeric, out-of-range and excessive-precision radii are rejected', () => {
  for (const value of ['', ' ', null, undefined, false, true, [], {}, 'abc', 0, -1, 101, '100.01', '0.001', '5.555', Infinity, NaN]) {
    assert.equal(parseCoverageRadius(value), null, String(value));
  }
});

test('both add and edit submit the validated radius in multipart FormData', () => {
  assert.equal((source.match(/const coverageRadius = parseCoverageRadius\(formData\.coverage_radius_m\);/g) || []).length, 2);
  assert.equal((source.match(/request\.append\('coverage_radius_m', String\(coverageRadius\)\);/g) || []).length, 2);
  assert.equal((source.match(/if \(coverageRadius === null\)/g) || []).length, 2);
});

test('initial state and both new-point resets use the same default', () => {
  assert.equal((source.match(/coverage_radius_m: DEFAULT_GUIDANCE_COVERAGE_RADIUS_M/g) || []).length, 3);
});

test('add and edit each have a labeled radius field reusing the existing input style', () => {
  for (const prefix of ['add', 'edit']) {
    assert.ok(source.includes(`htmlFor="${prefix}-guidance-coverage-radius"`));
    assert.ok(source.includes(`id="${prefix}-guidance-coverage-radius"`));
  }
  const inputs = [...source.matchAll(/<input\s+[\s\S]*?\/>/g)].map(([input]) => input)
    .filter((input) => input.includes('name="coverage_radius_m"'));
  assert.equal(inputs.length, 2);
  for (const input of inputs) {
    assert.match(input, /className="form-input-add-admin"/);
    assert.match(input, /min="0.01"/);
    assert.match(input, /max="100"/);
    assert.match(input, /step="0.01"/);
    assert.match(input, /value=\{formData\.coverage_radius_m\}/);
    assert.match(input, /coverage_radius_m: e\.target\.value/);
    assert.doesNotMatch(input, /style=/);
  }
});

// Source-level integration guards; these do not test tile-server availability.
test('guidance placement reuses the exact satellite style used during navigation', () => {
  const routeMap = readFileSync(new URL('../src/components/map/RouteMap.jsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ MBTILES_SATELLITE_STYLE \} from '\.\.\/services\/mbtilesMapStyle';/);
  assert.match(routeMap, /import \{ MBTILES_SATELLITE_STYLE \} from '\.\.\/\.\.\/services\/mbtilesMapStyle';/);
  assert.match(routeMap, /const mapStyle = MBTILES_SATELLITE_STYLE;/);
  assert.match(source, /style: MBTILES_SATELLITE_STYLE,/);
  assert.doesNotMatch(source, /osm-voyager\/style-en\.json/);
  // Do not fork the shared URL, numbering scheme, tile size or zoom settings here.
  assert.doesNotMatch(source, /tiles:\s*\[|scheme:\s*['"]|tileSize:\s*\d/);
});

test('add and edit share the map initializer while retaining coordinate selection', () => {
  assert.equal((source.match(/new maplibregl\.Map\(/g) || []).length, 1);
  const initializerStart = source.indexOf('const initializeMap =');
  const initializerEnd = source.indexOf('// Cleanup map on unmount', initializerStart);
  assert.ok(initializerStart >= 0 && initializerEnd > initializerStart);
  const initializer = source.slice(initializerStart, initializerEnd);
  assert.match(initializer, /center: \[lng, lat\]/);
  assert.match(initializer, /zoom: 16/);
  assert.match(initializer, /draggable: true/);
  assert.match(initializer, /map\.on\('click'/);
  assert.match(initializer, /markerRef\.current\.on\('dragend'/);
  assert.match(initializer, /location: newLocation/);

  const addStart = source.indexOf('const openAddModal =');
  const editStart = source.indexOf('const openEditModal =');
  const deleteStart = source.indexOf('const openDeleteModal =');
  assert.ok(addStart >= 0 && editStart > addStart && deleteStart > editStart);
  assert.match(source.slice(addStart, editStart), /initializeMap\(36\.2880, 59\.6157\)/);
  assert.match(source.slice(editStart, deleteStart), /initializeMap\(mark\.location\.lat, mark\.location\.lng\)/);
});
