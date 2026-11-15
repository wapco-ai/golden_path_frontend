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

async function setupRoute(page, fromQr = false) {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route(url => !['127.0.0.1', 'localhost'].includes(url.hostname), route => route.abort());
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({
    json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] }
  }));
  await page.addInitScript(({geo,steps,fromQr})=>{
    const origin={name:'مبدأ',floor:-1,coordinates:[36.287,59.615], ...(fromQr && { source: 'qr' })};
    const destination={name:'مقصد',floor:1,coordinates:[36.287,59.6152]};
    const state={origin,destination,routeGeo:geo,routeSteps:steps,alternativeRoutes:[],transportMode:'walking',gender:'both'};
    localStorage.setItem('route-storage',JSON.stringify({state,version:1}));
    for(const [key,value] of Object.entries({origin,destination,routeGeo:geo,routeSteps:steps,alternativeRoutes:[]})) sessionStorage.setItem(key,JSON.stringify(value));
    sessionStorage.setItem('haramCurrentFloor','1');
    if (fromQr) {
      const [lat, lng] = origin.coordinates;
      const id = 'END-TRIP-QR';
      for (const [key, value] of Object.entries({ qrLat: lat, qrLng: lng, qrId: id, qrFloor: -1,
        qrVerified: [lat, lng, id].join('|'), qrCapturedAt: Date.now() })) sessionStorage.setItem(key, String(value));
    }
  },{geo,steps,fromQr});
  await page.route('**/api/v1/**',r=>r.fulfill({json:{status:'NO_MATCH',data:[],features:[]}}));
  if (fromQr) {
    await page.clock.setFixedTime(new Date());
    await page.route('**/api/v1/qrcodes/END-TRIP-QR?*', route => route.fulfill({
      json: { id: 'END-TRIP-QR', floor: -1, coordinates: [36.287, 59.615] }
    }));
  }
  await page.route('**/tiles/**',r=>r.fulfill({status:204}));
  await page.route('**/tms/**',r=>r.fulfill({status:204}));
  return errors;
}

test('RNG previews transfers in sequence and switches the existing map floor',async({page})=>{
  const errors=await setupRoute(page);
  await page.goto('/#/rng', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.instruction-text')).toContainText('حرکت در طبقه منفی یک', { timeout: 20000 });
  await page.locator('.direction-icon-rng').click();
  await expect(page.locator('.instruction-text')).toContainText('با آسانسور به طبقه یک بروید');
  expect(await page.evaluate(()=>sessionStorage.getItem('haramCurrentFloor'))).toBe('-1');
  await page.locator('.direction-icon-rng').click();
  await expect(page.locator('.instruction-text')).toContainText('حرکت در طبقه یک');
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('haramCurrentFloor'))).toBe('1');
  expect(errors).toEqual([]);
});

test('route overview shows the current floor and the transfer duration in the existing carousel',async({page})=>{
  const errors=await setupRoute(page);
  await page.goto('/#/rop', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.instruction-text2')).toContainText('حرکت در طبقه منفی یک', { timeout: 20000 });
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('haramCurrentFloor'))).toBe('-1');
  await page.locator('.carousel-next').click();
  await expect(page.locator('.instruction-text2')).toContainText('با آسانسور به طبقه یک بروید');
  await expect(page.locator('.route-time .time-value')).toContainText('۳۶');
  await expect(page.locator('.route-time .time-value')).toContainText('ثانیه');
  await page.locator('.carousel-next').click();
  await expect(page.locator('.instruction-text2')).toContainText('حرکت در طبقه یک');
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('haramCurrentFloor'))).toBe('1');
  await page.locator('.carousel-next').click();
  await expect(page.locator('.instruction-text2')).toContainText('به مقصد رسیدید');
  await expect(page.locator('.carousel-next')).toBeDisabled();
  expect(errors).toEqual([]);
});

test('ending a trip opens the home map at the confirmed landing and retires the route history', async ({ page }) => {
  const errors = await setupRoute(page);
  await page.goto('/#/rop', { waitUntil: 'commit' });
  await page.locator('.start-routing-btn').click();
  await page.locator('.start-routing-button').click();
  await page.locator('.direction-icon-rng').click();
  await expect(page.locator('.instruction-text')).toContainText('با آسانسور به طبقه یک بروید');
  await page.locator('.direction-icon-rng').click();
  await expect(page.locator('.instruction-text')).toContainText('حرکت در طبقه یک');

  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.querySelector('.Toastify')?.textContent.includes('مسیریابی پایان یافت')) {
        window.tripEndedToastShown = true;
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.getByRole('button', { name: 'پایان و بستن سفر' }).click();
  await expect(page).toHaveURL(/#\/mpb$/);
  await expect.poll(() => page.evaluate(() => window.tripEndedToastShown), { timeout: 15000 }).toBe(true);
  await expect(page.locator('.routing-page')).toHaveCount(0);
  const marker = page.locator('.map-marker-origin');
  await expect(marker).toBeVisible();
  const canvas = page.getByRole('region', { name: 'Map', exact: true });
  await expect.poll(async () => {
    const [point, map] = await Promise.all([marker.boundingBox(), canvas.boundingBox()]);
    return Math.abs(point.x + point.width / 2 - map.x - map.width / 2) < 2
      && Math.abs(point.y + point.height / 2 - map.y - map.height / 2) < 2;
  }, { timeout: 20000 }).toBe(true);
  expect(await page.evaluate(() => ({
    position: history.state.usr.finishedTrip,
    floor: sessionStorage.getItem('haramCurrentFloor'),
    route: JSON.parse(localStorage.getItem('route-storage')).state.routeGeo,
    savedRoute: sessionStorage.getItem('routeGeo'),
  }))).toMatchObject({ position: { coordinates: [36.287, 59.6151], floor: 1 }, floor: '1', route: null, savedRoute: null });

  await page.goBack();
  await expect(page).toHaveURL(/#\/mpb$/);
  await expect(page.locator('.instruction-text2')).toHaveCount(0);
  await expect(marker).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/#\/mpb$/);
  await expect(page.locator('.routing-page')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('ending a trip during a pause keeps the last verified QR location and floor', async ({ page }) => {
  await setupRoute(page, true);
  await page.goto('/#/rng', { waitUntil: 'commit' });
  await page.locator('.start-routing-button').click();
  await page.getByRole('button', { name: 'توقف موقت', exact: true }).click();
  await page.getByRole('button', { name: 'پایان و بستن سفر' }).click();
  await expect(page).toHaveURL(/#\/mpb$/);
  await expect(page.getByText('آخرین موقعیت ثبت‌شده', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => history.state.usr.finishedTrip)).toMatchObject({
    coordinates: [36.287, 59.615], floor: -1, lastKnown: true
  });
});
