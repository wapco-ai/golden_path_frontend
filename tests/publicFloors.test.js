import test from 'node:test';
import assert from 'node:assert/strict';
import { getPointFloor, normalizeFloor, normalizeFloorCatalog, pointIsOnFloor } from '../src/utils/floors.js';
import { normalizeSubGroupMetadata } from '../src/utils/groupMetadata.js';
import { useRouteStore } from '../src/store/routeStore.js';
import { setSessionFloor } from '../src/utils/sessionFloor.js';
import { requestRouting } from '../src/services/routingService.js';
import { routeOnMapFloor } from '../src/utils/multifloorRoute.js';

test('missing, malformed and zero floor remain distinct; subgroup geo floor is preserved', () => {
  for (const value of [null, undefined, '', ' ', true, false, [], {}, 0.5, 32768]) assert.equal(normalizeFloor(value), null);
  for (const floor of [-3, -1, 0, 1, 7]) assert.equal(normalizeFloor(String(floor)), floor);
  assert.equal(getPointFloor({ geo: { floor: 0 } }), 0);
  assert.equal(getPointFloor({ properties: { floor: -1 } }), -1);
  assert.equal(pointIsOnFloor({}, null), false);
  const groups = normalizeSubGroupMetadata({ elevator: [{ value: 'lift', label: 'Lift', geo: { lat: 36.3, lng: 59.6, floor: -1 } }] }, 'fa');
  assert.equal(groups.elevator[0].floor, -1);
});

test('public catalog is deduplicated and ordered by floor sort order', () => {
  const floors = normalizeFloorCatalog([{floor:0,sort_order:0},{floor:'-1',sort_order:-1},{floor:2,sort_order:2},{floor:0},{floor:null}]);
  assert.deepEqual(floors.map(item => item.floor), [2,0,-1]);
  assert.throws(() => normalizeFloorCatalog({ floors: [] }));
});

test('browsing and destination selection never change a saved origin floor', () => {
  const store = useRouteStore.getState();
  store.setOrigin({ coordinates: [36.3,59.6], floor: 0 });
  setSessionFloor(-1);
  store.setDestination({ coordinates: [36.3,59.6], geo: {floor:-1} });
  assert.equal(useRouteStore.getState().origin.floor, 0);
  assert.equal(useRouteStore.getState().destination.floor, -1);
  store.setOrigin({ coordinates: [36.3,59.6], source:'gps' });
  assert.equal(useRouteStore.getState().origin.floor, null);
  store.clearRoute();
});

test('routing rejects an unconfirmed GPS floor before any network request', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => { requests++; throw new Error('unexpected request'); });
  setSessionFloor(-1);
  await assert.rejects(requestRouting({ origin: {coordinates:[36.3,59.6]}, destination: {coordinates:[36.3,59.6],floor:-1} }), /floor/);
  assert.equal(requests, 0);
});

test('floor catalog shares concurrent requests and retries after a failure', async t => {
  const { fetchFloors } = await import('../src/services/floorService.js?public-floor-tests');
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    requests++;
    if (requests === 1) return {ok:false};
    return {ok:true,json:async()=>[{floor:0,label:'همکف',sort_order:0},{floor:-1,label:'منفی ۱',sort_order:-1}]};
  });
  await assert.rejects(fetchFloors());
  const [a,b] = await Promise.all([fetchFloors(),fetchFloors()]);
  assert.equal(a,b);
  assert.equal(requests,2);
  await fetchFloors();
  assert.equal(requests,2);
});

test('an ordinary same-floor route is hidden when browsing another floor', () => {
  const geo = {type:'Feature',geometry:{type:'LineString',coordinates:[[59.6,36.3],[59.61,36.3]]}};
  assert.equal(routeOnMapFloor(geo, 0, 0), geo);
  assert.deepEqual(routeOnMapFloor(geo, -1, 0), {type:'FeatureCollection',features:[]});
});

test('a new QR clears a previous floor and empty coordinates are not accepted', async t => {
  const values = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', {value:{getItem:key=>values.get(key) ?? null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},configurable:true});
  t.after(() => { if (previous) Object.defineProperty(globalThis,'sessionStorage',previous); else delete globalThis.sessionStorage; });
  const {captureQrLocation,readQrPoint} = await import('../src/services/qrLocationService.js');
  captureQrLocation(new URLSearchParams('lat=36.3&lng=59.6&id=old&floor=-1'));
  assert.equal(readQrPoint().floor,-1);
  captureQrLocation(new URLSearchParams('lat=36.3&lng=59.6&id=new'));
  assert.equal(readQrPoint().floor,null);
  values.clear();
  captureQrLocation(new URLSearchParams('lat=&lng=&floor=0'));
  assert.equal(readQrPoint(),null);
});
