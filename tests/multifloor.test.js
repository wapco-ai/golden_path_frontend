import test from 'node:test';
import assert from 'node:assert/strict';
import { routeOnFloor, routeCoordinates, multifloorSteps, activeRouteCoordinates } from '../src/utils/multifloorRoute.js';
import { connectorError, connectorPayload, emptyConnector, newStop, floorValue, floorLabel, isSelectedStop } from '../src/utils/connectorForm.js';
import { getNavigationProgress } from '../src/utils/rngNavigation.js';
import { requestRouting } from '../src/services/routingService.js';
import { analyzeRoute } from '../src/utils/routeAnalysis.js';
import { setSessionFloor } from '../src/utils/sessionFloor.js';

const a = [[59.6,36.3],[59.6001,36.3]];
const b = [[59.6001,36.3],[59.6002,36.3]];
const geo = { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [a,b] }, properties: {
  multifloor: true, durationSeconds: 56, distanceMeters: 20, segments: [
    { id:0,kind:'walk',floor:-1,geometry:{type:'LineString',coordinates:a},duration_s:10,distance_m:10 },
    { id:1,kind:'elevator',fromFloor:-1,toFloor:1,geometry:null,duration_s:36,distance_m:0 },
    { id:2,kind:'walk',floor:1,geometry:{type:'LineString',coordinates:b},duration_s:10,distance_m:10 }
  ] } };
const steps = [
  { type:'stepStart',segmentId:0,floor:-1,routeM:0,coordinates:[[36.3,59.6],[36.3,59.6001]] },
  { type:'stepChangeFloor',segmentId:1,floor:-1,fromFloor:-1,toFloor:1,duration_s:36,coordinates:[[36.3,59.6001],[36.3,59.6001]],instruction:'آسانسور به طبقه ۱' },
  { type:'stepStart',segmentId:2,floor:1,routeM:0,coordinates:[[36.3,59.6001],[36.3,59.6002]] },
  { type:'stepArriveDestination',segmentId:2,floor:1,routeM:1,coordinates:[[36.3,59.6002],[36.3,59.6002]] }
];

test('overlapping floors render separate walk lines with no transfer line', () => {
  assert.deepEqual(routeOnFloor(geo,-1).features.map(f => f.geometry.coordinates), [a]);
  assert.deepEqual(routeOnFloor(geo,1).features.map(f => f.geometry.coordinates), [b]);
  assert.equal(routeOnFloor(geo,0).features.length,0);
  assert.equal(routeCoordinates(geo).length,4);
});
test('segment measures restart per floor and keep elevator time exactly once', () => {
  const result = multifloorSteps(geo,steps);
  assert.equal(result.length,4);
  assert.equal(result.reduce((n,s) => n+s.durationSeconds,0),56);
  assert.equal(result[1].distanceMeters,0);
  assert.equal(result[1].durationSeconds,36);
  assert.deepEqual(activeRouteCoordinates(geo,result[2]),b);
  assert.deepEqual(result.map(s => s.floor),[-1,-1,1,1]);
});
test('GPS at identical XY cannot advance through an unconfirmed floor transfer', () => {
  const result = multifloorSteps(geo,steps);
  assert.deepEqual(getNavigationProgress({lat:36.3,lng:59.6001},result,1,a),{nextStep:1,arrived:false});
  assert.equal(getNavigationProgress({lat:36.3,lng:59.6001},result,0,a).nextStep,1);
  assert.equal(getNavigationProgress({lat:36.3,lng:59.6002},result,3,b).arrived,true);
});
test('same-floor geometry retains the original feature object', () => {
  const single = {type:'Feature',geometry:{type:'LineString',coordinates:a}};
  assert.equal(routeOnFloor(single,0),single);
  assert.equal(multifloorSteps(single,steps),null);
});
test('form rejects incomplete, duplicate and unresolved stops', () => {
  const c={...emptyConnector(),stops:[newStop(0),newStop(1)]};
  assert.match(connectorError(c,'elevator',['walk']),/نقشه/);
  c.stops=c.stops.map(s => ({...s,lat:36.3,lon:59.6,area_id:1}));
  assert.equal(connectorError(c,'elevator',['walk']),'');
  assert.ok(connectorError({...c,stops:[c.stops[0],c.stops[0]]},'elevator',['walk']));
  assert.ok(connectorError({...c,stops:[c.stops[0],{...c.stops[1],area_id:null}]},'elevator',['walk']));
  assert.ok(connectorError(c,'stair',['wheelchair']));
  assert.ok(connectorError(c,'escalator',['walk']));
});
test('API payload preserves shared identity, order, zero floor and optional reverse time', () => {
  const payload=connectorPayload({id:8,version:4,direction:'both',wait_seconds:20,stops:[
    {floor:0,access_id:7,area_id:1,travel_seconds:'8',reverse_seconds:null,areas:[]},
    {floor:1,lat:36.3,lon:59.6,area_id:2,travel_seconds:8,reverse_seconds:10}
  ]},'elevator',{basic_info:{title:{fa:'آسانسور'}}});
  assert.equal(payload.version,4);
  assert.equal(payload.stops[0].floor,0);
  assert.equal(payload.stops[0].access_id,7);
  assert.equal(payload.stops[0].reverse_seconds,null);
  assert.equal(payload.stops[1].reverse_seconds,10);
  assert.equal('areas' in payload.stops[0],false);
});
test('existing and additional floor labels round trip without becoming ground floor', () => {
  for (const floor of [-3,-1,0,1,4]) assert.equal(floorValue(floorLabel(floor)),floor);
});
test('the selected portal stays fixed by identity across reordering and coincident floor coordinates', () => {
  const point={floor:0,door_id:10,access_id:7,lat:36.3,lon:59.6};
  const stops=[{...point,floor:-1,door_id:11,access_id:8},{...point,access_id:70},{...point,floor:1,door_id:12,access_id:9}];
  assert.deepEqual(stops.map(s=>isSelectedStop(s,point)),[false,true,false]);
  assert.deepEqual([stops[1],stops[2],stops[0]].map(s=>isSelectedStop(s,point)),[true,false,false]);
  assert.equal(isSelectedStop({...point,door_id:99,access_id:99},point),false);
  const draft={floor:0,lat:36.3,lon:59.6};
  assert.equal(isSelectedStop(stops[1],draft),true);
  assert.equal(isSelectedStop({...draft,floor:1},draft),false);
  assert.equal(isSelectedStop(newStop(0),draft),false);
});
test('routing request and response preserve floor and transfer metadata', async t => {
  let body;
  t.mock.method(globalThis,'fetch',async (_url,options) => {
    body=JSON.parse(options.body);
    return {ok:true,json:async () => ({geo,steps:[{type:'stepChangeFloor',coord:{lat:36.3,lon:59.6},endCoord:{lat:36.3,lon:59.6001},fromFloor:-1,toFloor:1,floor:-1,segmentId:1,duration_s:36}],estimatedMinutes:56/60,distanceMeters:20})};
  });
  const r=await requestRouting({origin:{coordinates:[36.3,59.6],floor:-1},destination:{coordinates:[36.3,59.6],floor:1}});
  assert.equal(body.origin.floor,-1); assert.equal(body.destination.floor,1);
  assert.equal(r.steps[0].toFloor,1); assert.equal(r.steps[0].segmentId,1);
  assert.deepEqual(r.steps[0].coordinates[1],[36.3,59.6001]);
  assert.equal(r.durationSeconds,56);
});
test('local fallback cannot connect identical points on different floors', () => {
  setSessionFloor(0);
  assert.equal(analyzeRoute({coordinates:[36.3,59.6],floor:0},{coordinates:[36.3,59.6],floor:1},{features:[]}),null);
});

test('coincident landings advance to the transfer but require confirmation before arrival', () => {
  const point={lat:36.3,lng:59.6};
  const coords=[[59.6,36.3],[59.6,36.3]];
  const local=[{type:'stepStart',segmentId:0,coordinates:coords},{type:'stepChangeFloor',segmentId:1,coordinates:coords},
    {type:'stepArriveDestination',segmentId:2,coordinates:coords}];
  assert.equal(getNavigationProgress(point,local,0,coords).nextStep,1);
  assert.deepEqual(getNavigationProgress(point,local,1,coords),{nextStep:1,arrived:false});
  assert.equal(getNavigationProgress(point,local,2,coords).arrived,true);
});
