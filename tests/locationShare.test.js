import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('location sharing uses the refresh-capable authenticated API client', () => {
  const service = read('src/services/locationShareService.js');
  const config = read('src/config/appConfig.js');

  assert.match(config, /locationSharesUrl/);
  assert.match(service, /import apiUser from '\.\.\/api\/apiUser'/);
  assert.match(service, /apiUser\(config\)/);
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

test('incoming shares refresh while routing pages stay mounted and auth changes clear state', () => {
  const component = read('src/components/common/LocationShareOverlay.jsx');

  assert.match(component, /REFRESH_INTERVAL_MS = 30000/);
  assert.match(component, /window\.setInterval/);
  assert.match(component, /document\.visibilityState === 'visible'/);
  assert.match(component, /identityRef/);
  assert.match(component, /setIncoming\(\[\]\)/);
  assert.match(component, /setOutgoing\(\[\]\)/);
  assert.match(component, /AbortController/);
});

test('shared recipient location reuses the existing destination routing flow on mpr and fs', () => {
  const component = read('src/components/common/LocationShareOverlay.jsx');
  const app = read('src/App.jsx');

  assert.match(component, /source: 'shared_location'/);
  assert.match(component, /coordinates: \[lat, lng\]/);
  assert.match(component, /floor,/);
  assert.match(component, /navigate\('\/fs'\)/);
  assert.match(component, /goldenpath:destination-updated/);
  assert.match(app, /goldenpath:destination-updated/);
  assert.match(app, /FinalSearch key=/);
});

test('location share dialog supports keyboard modality and stays below map pickers', () => {
  const component = read('src/components/common/LocationShareOverlay.jsx');
  const styles = read('src/styles/LocationShareOverlay.css');

  assert.match(component, /event\.key === 'Escape'/);
  assert.match(component, /event\.key !== 'Tab'/);
  assert.match(component, /previousFocusRef/);
  assert.match(component, /aria-modal="true"/);
  assert.match(styles, /\.location-share-overlay[\s\S]*?z-index: 900/);
  assert.match(styles, /\.location-share-backdrop[\s\S]*?z-index: 1600/);
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
