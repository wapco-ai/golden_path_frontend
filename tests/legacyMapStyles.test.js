import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isLegacyMapStyle, loadLegacyMapStyle, mapAssetRequest } from '../src/services/legacyMapStyles.js';

const readAsset = path => JSON.parse(readFileSync(new URL(`../public${path}`, import.meta.url), 'utf8'));

test('legacy styles, fonts, sprites and vector tile templates follow the page origin', async t => {
  t.after(() => { delete globalThis.window; });
  t.mock.method(globalThis, 'fetch', async url => {
    const { origin, pathname } = new URL(url);
    assert.equal(origin, window.location.origin);
    return { ok: true, json: async () => readAsset(pathname) };
  });

  for (const origin of ['http://127.0.0.1:5173', 'https://maps.example.test']) {
    globalThis.window = { location: { origin } };
    for (const [name, files] of [
      ['osm-voyager', ['style.json', 'style-en.json']],
      ['osm-basic', ['style.json']],
      ['osm-streets-3d', ['style.json']]
    ]) {
      const root = `/map-styles/${name}`;
      for (const file of files) {
        const path = `${root}/${file}`;
        assert.equal(isLegacyMapStyle(`.${path}`), true);
        assert.equal(mapAssetRequest(`.${path}`, 'Style').url, `goldenpath-style://${path}`);
        const style = await loadLegacyMapStyle(path);
        assert.equal(style.sprite, `${origin}${root}/sprite`);
        assert.equal(style.glyphs, `${origin}/fonts/{fontstack}/{range}.pbf`);
        const source = Object.values(style.sources).find(item => item.url);
        assert.equal(source.url, `${origin}${root}/tiles.json`);
      }
      const { tiles } = readAsset(`${root}/tiles.json`);
      assert.deepEqual(tiles, ['/tms/services/mashhad/tiles/{z}/{x}/{y}.pbf']);
      assert.equal(mapAssetRequest(tiles[0]).url, `${origin}${tiles[0]}`);
    }
  }
});

test('a style can omit sprites and glyphs', async t => {
  globalThis.window = { location: { origin: 'http://127.0.0.1:5173' } };
  t.after(() => { delete globalThis.window; });
  const style = { version: 8, sources: {}, layers: [] };
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => style }));
  assert.deepEqual(await loadLegacyMapStyle('/map-styles/osm-voyager/style.json'), style);
});
