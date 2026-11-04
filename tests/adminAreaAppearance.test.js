import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createPropertyExpression, latest } from '@maplibre/maplibre-gl-style-spec';
import { adminAreaFillPaint, adminAreaOutlinePaint, getAreaAppearance, createAreaAppearanceLoader } from '../src/utils/adminAreaAppearance.js';
import { bindAdminAreaAppearance, getAdminAppearanceFloor } from '../src/utils/bindAdminAreaAppearance.js';

const evaluate = (property, state, properties = { area_type: 'riwaq', is_closed: false }) => {
  const paint = property.startsWith('fill') ? adminAreaFillPaint() : adminAreaOutlinePaint();
  const type = property.split('-')[0];
  const parsed = createPropertyExpression(paint[property], latest[`paint_${type}`][property]);
  assert.equal(parsed.result, 'success', JSON.stringify(parsed.value));
  return parsed.value.evaluate({ zoom: 16 }, { type: 3, properties }, state);
};

test('real ownership/coverage fields survive string JSON and explicit false values', () => {
  assert.deepEqual(getAreaAppearance({ attrs: JSON.stringify({
    access_policy: { public_access: false }, operational: { is_covered: false }
  }) }), { areaPublic: false, areaCovered: false });
  assert.deepEqual(getAreaAppearance({ attrs: { source_properties: { Noefaali_1: 'عمومی', indoor: 'سرپوشیده' } } }),
    { areaPublic: true, areaCovered: true });
  assert.equal(getAreaAppearance({ attrs: { source_properties: { owner: 'اختصاصی' } } }).areaPublic, false);
  assert.equal(getAreaAppearance({ is_closed: true, attrs: { access_policy: { public_access: true } } }).areaPublic, false);
  assert.deepEqual(getAreaAppearance({ attrs: 'null' }), { areaPublic: null, areaCovered: null });
});

test('private areas share a gray fill regardless of technical type; roof changes intensity', () => {
  const privateRiwaq = evaluate('fill-color', { areaPublic: false, areaCovered: true });
  const privateCourt = evaluate('fill-color', { areaPublic: false, areaCovered: false }, { area_type: 'courtyard' });
  assert.deepEqual(privateRiwaq, privateCourt);
  assert.notDeepEqual(privateRiwaq, evaluate('fill-color', { areaPublic: true }));
  assert.ok(evaluate('fill-opacity', { areaCovered: true }) > evaluate('fill-opacity', { areaCovered: false }));
  assert.notDeepEqual(evaluate('fill-color', {}), evaluate('fill-color', { areaPublic: true }));
  for (const property of Object.keys(adminAreaOutlinePaint())) evaluate(property, {});
});

test('metadata includes every page, keeps floors separate, and refreshes after editing', async () => {
  const requests = [];
  let revision = 0;
  const load = createAreaAppearanceLoader(async params => {
    requests.push(params);
    return { last_page: 3, data: [{ id: params.page, floor: params.floor,
      attrs: { access_policy: { public_access: revision === 0 }, operational: { is_covered: true } } },
    { id: 'wrong-floor', floor: 99 }, { id: 'missing-floor', floor: null }] };
  });
  const first = load(0), shared = load(0);
  assert.equal(first, shared);
  const rows = await first;
  assert.equal(rows.size, 3);
  assert.deepEqual(requests.map(r => r.page), [1, 2, 3]);
  revision++;
  assert.equal((await load(0, { force: true })).get('1').areaPublic, false);
  await load(-1);
  assert.equal(requests.at(-1).floor, -1);
});

test('a failed metadata request can be retried', async () => {
  let attempt = 0;
  const load = createAreaAppearanceLoader(async () => {
    if (++attempt === 1) throw new Error('temporary failure');
    return { data: [], last_page: 1 };
  });
  await assert.rejects(load(0));
  assert.equal((await load(0)).size, 0);
});

class MapFixture extends EventEmitter {
  source = { tiles: ['http://localhost/areas/{z}/{x}/{y}?p_floor=0'] };
  states = [];
  getSource() { return this.source; }
  setFeatureState(target, state) { this.states.push({ target, state }); }
  fire() { this.emit('sourcedata', { sourceId: 'areas' }); }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 45));

test('a late response from another floor cannot repaint the active floor; style reload restores states', async () => {
  const map = new MapFixture(), pending = new Map();
  const load = floor => new Promise(resolve => pending.set(floor, resolve));
  bindAdminAreaAppearance(map, 'areas', load);
  bindAdminAreaAppearance(map, 'areas', load);
  await tick();
  map.source.tiles = ['http://localhost/areas/{z}/{x}/{y}?p_floor=-1'];
  map.fire(); await tick();
  pending.get(-1)(new Map([['101', { areaPublic: false, areaCovered: true }]]));
  await tick();
  pending.get(0)(new Map([['999', { areaPublic: true, areaCovered: false }]]));
  await tick();
  assert.deepEqual(map.states.map(s => s.target.id), ['101']);
  assert.equal(getAdminAppearanceFloor(map), -1);
  map.source = { tiles: ['http://localhost/areas/{z}/{x}/{y}?p_floor=-1'] };
  map.emit('styledata'); await tick();
  pending.get(-1)(new Map([['101', { areaPublic: false, areaCovered: true }]]));
  await tick();
  assert.equal(map.states.length, 2);
  map.emit('remove');
  assert.equal(map.listenerCount('sourcedata'), 0);
});
