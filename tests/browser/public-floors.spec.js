import { test, expect } from '@playwright/test';

const floors = [{floor:1,label:'طبقه ۱',sort_order:1},{floor:0,label:'همکف',sort_order:0},{floor:-1,label:'منفی ۱',sort_order:-1}];
const line = [[59.615,36.287],[59.6151,36.287]];
const place = (floor, id) => ({ id:String(id), title:'مکان آزمایشی', floor, coordinates:[36.287,59.615], address:'حرم', subGroupValue:`poi-${id}` });

async function setup(page, options = {}) {
  const requests = [], tiles = [], errors = [];
  let floorRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('selectedMapType', 'base');
    localStorage.setItem('lang-storage', JSON.stringify({ state:{language:'fa'},version:1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let json = {data:[],features:[],status:'NO_MATCH'};
    if (path.endsWith('/floors')) {
      floorRequests++;
      if (options.failFirstFloors && floorRequests === 1) return route.fulfill({status:503,json:{message:'unavailable'}});
      json = options.floors || floors;
    } else if (path.endsWith('/groups/metadata')) json = {groups:[]};
    else if (path.endsWith('/groups/subgroups')) json = {subGroups:{}};
    else if (path.endsWith('/landmark-places')) json = {places:{landmarkPlaces:url.searchParams.get('search') ? [place(0,1),place(-1,2)] : []}};
    else if (path.includes('/qrcodes/')) json = {id:'test-qr',floor:-1,title:'مبدأ QR',coordinates:[36.287,59.615]};
    else if (path.endsWith('/routing/route')) {
      const body = route.request().postDataJSON(); requests.push(body);
      const from = body.origin.floor, to = body.destination.floor;
      json = {geo:{type:'Feature',geometry:{type:'MultiLineString',coordinates:[line,line]},properties:{multifloor:true,durationSeconds:56,distanceMeters:20,segments:[
        {id:0,kind:'walk',floor:from,geometry:{type:'LineString',coordinates:line},duration_s:10,distance_m:10},
        {id:1,kind:'elevator',fromFloor:from,toFloor:to,geometry:null,duration_s:36,distance_m:0},
        {id:2,kind:'walk',floor:to,geometry:{type:'LineString',coordinates:line},duration_s:10,distance_m:10}
      ]}},steps:[
        {type:'stepStart',segmentId:0,floor:from,routeM:0,coordinates:[[36.287,59.615],[36.287,59.6151]],instruction:'حرکت'},
        {type:'stepChangeFloor',segmentId:1,floor:from,fromFloor:from,toFloor:to,duration_s:36,coordinates:[[36.287,59.6151],[36.287,59.6151]],instruction:'آسانسور'},
        {type:'stepArriveDestination',segmentId:2,floor:to,coordinates:[[36.287,59.6151],[36.287,59.6151]],instruction:'مقصد'}
      ],alternatives:[],estimatedMinutes:1,distanceMeters:20};
    }
    await route.fulfill({json});
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({json:{version:8,glyphs:'http://localhost:8080/glyphs/{fontstack}/{range}.pbf',sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#e8e5dd'}}]}}));
  await page.route('**/tiles/**', route => { tiles.push(route.request().url()); return route.fulfill({status:204}); });
  await page.route('**/tms/**', route => route.fulfill({status:204}));
  return {requests,tiles,errors};
}

async function chooseFloor(page, name) {
  await page.locator('.gp-floor-trigger').click();
  await page.locator('.gp-floor-option').filter({hasText:name}).click();
  await expect(page.locator('.gp-floor-menu')).toHaveCount(0);
}

async function tapMap(page) {
  const map = page.locator('.map-routing-container .maplibregl-canvas');
  await expect(map).toBeVisible();
  await map.click({position:{x:130,y:115}});
}

for (const width of [360,430]) test(`mobile ${width}: floor control follows the approved style alignment and menu behavior`, async ({page}, testInfo) => {
  await page.setViewportSize({width,height:850});
  const {errors} = await setup(page);
  await page.goto('/#/mpb');
  const trigger = page.locator('.gp-floor-trigger');
  await expect(trigger).toBeVisible();
  const a = await trigger.boundingBox(), b = await page.locator('.map-style-button-mpr').boundingBox();
  expect(a.width).toBe(54); expect(a.height).toBe(54);
  expect(a.x).toBe(b.x); expect(a.y - (b.y+b.height)).toBe(14);
  await page.locator('.map-style-button-mpr').click();
  await expect(page.locator('.map-style-menu-mpr')).toBeVisible();
  await trigger.click();
  await expect(page.locator('.map-style-menu-mpr')).toHaveCount(0);
  await expect(page.locator('.gp-floor-option')).toHaveText(['طبقه ۱','همکف','منفی ۱']);
  const menu = await page.locator('.gp-floor-menu').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(0); expect(menu.y).toBeGreaterThanOrEqual(0);
  for (const row of await page.locator('.gp-floor-option').all()) expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:testInfo.outputPath(`floor-control-${width}.png`)});
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await chooseFloor(page, 'منفی ۱');
  await expect(trigger).toContainText('منفی ۱');
  expect(await page.evaluate(() => sessionStorage.getItem('selectedMapType'))).toBe('base');
  await trigger.click();
  await page.locator('.map-header-title').click();
  await expect(page.locator('.gp-floor-menu')).toHaveCount(0);
  await page.reload();
  await expect(trigger).toContainText('منفی ۱');
  expect(errors).toEqual([]);
});

test('map taps preserve origin floor while the destination is chosen on another floor', async ({page}) => {
  await page.setViewportSize({width:430,height:932});
  const {requests,tiles,errors} = await setup(page);
  await page.goto('/#/mpr');
  await tapMap(page);
  await expect(page.locator('.map-current-location input')).toHaveValue(/همکف/);
  await chooseFloor(page,'منفی ۱');
  await tapMap(page);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].origin.floor).toBe(0); expect(requests[0].destination.floor).toBe(-1);
  await expect(page.locator('.location-input.origin-input')).toContainText('همکف');
  await expect(page.locator('.location-input.destination-input')).toContainText('منفی');
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  const count = requests.length;
  await chooseFloor(page,'منفی ۱');
  await expect(page.locator('.gp-floor-trigger')).toContainText('منفی ۱');
  await page.waitForTimeout(500);
  expect(requests.length).toBe(count);
  await chooseFloor(page,'طبقه ۱');
  await expect(page.locator('.main-popup-container')).toHaveCount(0);
  await chooseFloor(page,'منفی ۱');
  expect(tiles.some(url => /[?&]p_floor=-1(?:&|$)|[?&]floor=-1(?:&|$)/.test(url))).toBe(true);
  await page.locator('.swap-btn').click();
  await expect.poll(() => requests.length).toBeGreaterThan(count);
  expect(requests.at(-1).origin.floor).toBe(-1); expect(requests.at(-1).destination.floor).toBe(0);
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('qrLat'))).toBeNull();
  expect(errors).toEqual([]);
});

test('search distinguishes identical names and coordinates on different floors', async ({page}) => {
  const {requests,errors} = await setup(page);
  await page.goto('/#/mpr');
  await page.locator('.map-current-location').click();
  await page.locator('.map-search-modal input').fill('مکان');
  const results = page.locator('.map-destination-list li');
  await expect(results).toHaveCount(2);
  await expect(results.first()).toContainText('همکف');
  await expect(results.last()).toContainText('منفی');
  await results.last().click();
  await expect(page.locator('.map-current-location input')).toHaveValue(/منفی/);
  await tapMap(page);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].origin.floor).toBe(-1); expect(requests[0].destination.floor).toBe(0);
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the floor button stays usable in origin and destination map-picking mode', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const {requests,errors} = await setup(page);
  await page.goto('/#/mpr');
  await page.locator('.map-current-location').click();
  await page.locator('.map-option-item').first().click();
  await chooseFloor(page,'منفی ۱');
  await tapMap(page);
  await page.locator('.map-destination-input-wrapper').click();
  await page.locator('.map-option-item').first().click();
  await chooseFloor(page,'طبقه ۱');
  await tapMap(page);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].origin.floor).toBe(-1); expect(requests[0].destination.floor).toBe(1);
  expect(errors).toEqual([]);
});

test('QR origin floor survives browsing and selecting a destination on the ground floor', async ({page}) => {
  const {requests,errors} = await setup(page);
  await page.goto('/?lat=36.287&lng=59.615&id=test-qr#/mpr');
  await expect(page.locator('.gp-floor-trigger')).toContainText('منفی ۱');
  await chooseFloor(page,'همکف');
  await tapMap(page);
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].origin.floor).toBe(-1); expect(requests[0].destination.floor).toBe(0);
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  await page.locator('.swap-btn').click();
  await expect.poll(() => requests.at(-1)?.origin.floor).toBe(0);
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  await page.locator('.location-input.origin-input').click();
  await page.locator('.map-option-item').first().click();
  await chooseFloor(page,'طبقه ۱');
  await tapMap(page);
  await expect.poll(() => requests.at(-1)?.origin.floor).toBe(1);
  expect(requests.at(-1).destination.floor).toBe(-1);
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('unknown origin floor is confirmed explicitly instead of inheriting the destination floor', async ({page}) => {
  const {requests,errors} = await setup(page);
  await page.addInitScript(() => {
    const state={origin:{name:'GPS',source:'gps',coordinates:[36.287,59.615],floor:null},destination:{name:'مقصد',floor:-1,coordinates:[36.287,59.615]}};
    localStorage.setItem('route-storage',JSON.stringify({state,version:1}));
    sessionStorage.setItem('haramCurrentFloor','-1');
  });
  await page.goto('/#/fs');
  await expect(page.getByRole('dialog',{name:'طبقهٔ مبدأ'})).toBeVisible();
  expect(requests).toHaveLength(0);
  await page.locator('.gp-floor-option').filter({hasText:'همکف'}).click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests[0].origin.floor).toBe(0); expect(requests[0].destination.floor).toBe(-1);
  expect(errors).toEqual([]);
});

test('catalog request failure offers retry without inventing available floors', async ({page}) => {
  await setup(page,{failFirstFloors:true});
  await page.goto('/#/mpb');
  await page.locator('.gp-floor-trigger').click();
  await expect(page.locator('.gp-floor-status')).toContainText('دریافت طبقات ناموفق بود');
  await expect(page.locator('.gp-floor-option')).toHaveCount(0);
  await page.getByRole('button',{name:'تلاش دوباره',exact:true}).click();
  await expect(page.locator('.gp-floor-option')).toHaveCount(3);
});

test('replacing a mapped origin with GPS waits for fresh coordinates and explicit floor', async ({page,context}) => {
  const {requests,errors} = await setup(page);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:36.287,longitude:59.615,accuracy:5});
  await page.goto('/#/mpr');
  await tapMap(page);
  await chooseFloor(page,'منفی ۱');
  await tapMap(page);
  await expect(page.locator('.location-input.origin-input')).toBeVisible();
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  const count = requests.length;
  await page.locator('.location-input.origin-input').click();
  await expect(page.locator('.map-option-item')).toHaveCount(2);
  await page.locator('.map-option-item').nth(1).click();
  await expect(page.getByRole('dialog',{name:'طبقهٔ مبدأ'})).toBeVisible();
  expect(requests.length).toBe(count);
  await page.locator('.gp-floor-option').filter({hasText:'همکف'}).click();
  await expect.poll(() => requests.length).toBeGreaterThan(count);
  expect(requests.at(-1).origin).toMatchObject({floor:0,lat:36.287,lon:59.615});
  expect(requests.at(-1).destination.floor).toBe(-1);
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('swapping endpoints replaces a pending floor request with the new target', async ({page}) => {
  const {requests,errors}=await setup(page);
  await page.addInitScript(() => {
    const state={origin:{name:'GPS',source:'gps',floor:null,coordinates:[36.287,59.615]},destination:{name:'Known',floor:-1,coordinates:[36.288,59.616]}};
    localStorage.setItem('route-storage',JSON.stringify({state,version:1}));
  });
  await page.goto('/#/fs');
  await expect(page.getByRole('dialog',{name:'طبقهٔ مبدأ'})).toBeVisible();
  await page.locator('.swap-btn').click();
  await expect(page.getByRole('dialog',{name:'طبقهٔ مقصد'})).toBeVisible();
  await page.locator('.gp-floor-option').filter({hasText:'همکف'}).click();
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests.at(-1).origin).toMatchObject({floor:-1,lat:36.288,lon:59.616});
  expect(requests.at(-1).destination).toMatchObject({floor:0,lat:36.287,lon:59.615});
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a single-floor catalog restores an unsupported display floor before hiding the control', async ({page}) => {
  const {tiles,errors}=await setup(page,{floors:[{floor:1,label:'طبقه ۱',sort_order:1}]});
  await page.goto('/#/mpb');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('haramCurrentFloor'))).toBe('1');
  await expect(page.locator('.gp-floor-trigger')).toHaveCount(0);
  await expect.poll(() => tiles.some(url => url.includes('p_floor=1'))).toBe(true);
  expect(errors).toEqual([]);
});

test('recent save-location choices show their floor even when names match', async ({page}) => {
  const {errors}=await setup(page);
  await page.goto('/#/pmap');
  await expect(page.locator('.gp-floor-trigger')).toHaveCount(0);
  const map=page.locator('.pmap-container .maplibregl-canvas');
  await map.click({position:{x:130,y:115}});
  await page.locator('.pmap-confirm-modal .pmap-cancel-button').click();
  await page.evaluate(() => {
    sessionStorage.setItem('haramCurrentFloor', '-1');
    window.dispatchEvent(new CustomEvent('haram-floor-change', { detail: { floor: -1 } }));
  });
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('haramCurrentFloor'))).toBe('-1');
  await map.click({position:{x:130,y:115}});
  await page.locator('.pmap-confirm-modal .pmap-cancel-button').click();
  await page.locator('.pmap-search-input').click();
  const rows=page.locator('.pmap-destination-list li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('منفی');
  await expect(rows.last()).toContainText('همکف');
  expect(errors).toEqual([]);
});
