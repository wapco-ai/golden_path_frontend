import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('location sharing uses authenticated internal API endpoints', () => {
  const service = read('src/services/locationShareService.js');
  const config = read('src/config/appConfig.js');

  assert.match(config, /locationSharesUrl/);
  assert.match(service, /Authorization = `Bearer \$\{token\}`/);
  assert.match(service, /\/incoming/);
  assert.match(service, /\/outgoing/);
  assert.match(service, /method: 'DELETE'/);
});

test('sharing takes one fresh user-initiated GPS fix and does not start live tracking', () => {
  const component = read('src/components/common/LocationShareOverlay.jsx');

  assert.match(component, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(component, /enableHighAccuracy: true/);
  assert.match(component, /maximumAge: 0/);
  assert.doesNotMatch(component, /watchPosition/);
});

test('shared recipient location reuses the existing destination routing flow', () => {
  const component = read('src/components/common/LocationShareOverlay.jsx');

  assert.match(component, /source: 'shared_location'/);
  assert.match(component, /coordinates: \[lat, lng\]/);
  assert.match(component, /floor,/);
  assert.match(component, /navigate\('\/fs'\)/);
});

test('overlay is limited to routing pages and supports all four product languages', () => {
  const component = read('src/components/common/LocationShareOverlay.jsx');
  const messages = read('src/utils/locationShareMessages.js');
  const app = read('src/App.jsx');

  assert.match(component, /new Set\(\['\/mpr', '\/fs'\]\)/);
  assert.match(app, /<LocationShareOverlay \/>/);
  for (const language of ['fa', 'ar', 'ur', 'en']) {
    assert.match(messages, new RegExp(`\\b${language}: \\{`));
  }
});
