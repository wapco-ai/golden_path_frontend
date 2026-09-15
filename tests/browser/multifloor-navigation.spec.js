import { test, expect } from '@playwright/test';

const a=[[59.615,36.287],[59.6151,36.287]];
const b=[[59.6151,36.287],[59.6152,36.287]];
const geo={type:'Feature',geometry:{type:'MultiLineString',coordinates:[a,b]},properties:{multifloor:true,durationSeconds:56,distanceMeters:20,segments:[
  {id:0,kind:'walk',floor:-1,geometry:{type:'LineString',coordinates:a},duration_s:10,distance_m:10},
  {id:1,kind:'elevator',floor:-1,fromFloor:-1,toFloor:1,geometry:null,duration_s:36,distance_m:0},
  {id:2,kind:'walk',floor:1,geometry:{type:'LineString',coordinates:b},duration_s:10,distance_m:10}
]}};
const steps=[
  {type:'stepStart',segmentId:0,floor:-1,routeM:0,coordinates:[[36.287,59.615],[36.287,59.6151]],instruction:'حرکت در طبقه منفی یک'},
  {type:'stepChangeFloor',segmentId:1,floor:-1,fromFloor:-1,toFloor:1,connectorId:7,duration_s:36,coordinates:[[36.287,59.6151],[36.287,59.6151]],instruction:'با آسانسور به طبقه یک بروید'},
  {type:'stepStart',segmentId:2,floor:1,routeM:0,coordinates:[[36.287,59.6151],[36.287,59.6152]],instruction:'حرکت در طبقه یک'},
  {type:'stepArriveDestination',segmentId:2,floor:1,routeM:1,coordinates:[[36.287,59.6152],[36.287,59.6152]],instruction:'به مقصد رسیدید'}
];

test('RNG previews transfers in sequence and switches the existing map floor',async({page})=>{
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({geo,steps})=>{
    const origin={name:'مبدأ',floor:-1,coordinates:[36.287,59.615]};
    const destination={name:'مقصد',floor:1,coordinates:[36.287,59.6152]};
    const state={origin,destination,routeGeo:geo,routeSteps:steps,alternativeRoutes:[],transportMode:'walking',gender:'both'};
    localStorage.setItem('route-storage',JSON.stringify({state,version:1}));
    for(const [key,value] of Object.entries({origin,destination,routeGeo:geo,routeSteps:steps,alternativeRoutes:[]})) sessionStorage.setItem(key,JSON.stringify(value));
    sessionStorage.setItem('haramCurrentFloor','-1');
  },{geo,steps});
  await page.route('**/api/v1/**',r=>r.fulfill({json:{status:'NO_MATCH',data:[],features:[]}}));
  await page.route('**/tiles/**',r=>r.fulfill({status:204}));
  await page.route('**/tms/**',r=>r.fulfill({status:204}));
  await page.goto('/#/rng');
  await expect(page.locator('.instruction-text')).toContainText('حرکت در طبقه منفی یک');
  await page.locator('.direction-icon-rng').click();
  await expect(page.locator('.instruction-text')).toContainText('با آسانسور به طبقه یک بروید');
  expect(await page.evaluate(()=>sessionStorage.getItem('haramCurrentFloor'))).toBe('-1');
  await page.locator('.direction-icon-rng').click();
  await expect(page.locator('.instruction-text')).toContainText('حرکت در طبقه یک');
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('haramCurrentFloor'))).toBe('1');
  expect(errors).toEqual([]);
});
