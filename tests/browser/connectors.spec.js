import { test, expect } from '@playwright/test';

const floors = [-1,0,1].map(floor => ({floor,label:floor === 0 ? 'همکف' : floor === -1 ? 'منفی ۱' : 'طبقه ۱'}));
const shared = { id:7,version:3,kind:'elevator',direction:'both',wait_seconds:20,
  info:{basic_info:{title:{fa:'آسانسور مشترک'},description:'توضیح مشترک'},operational:{place_function:'elevator',status:'active',transport_modes:['walk','wheelchair'],gender_access:['both']}},
  stops: floors.map(({floor},i) => ({floor,access_id:100+i,door_id:200+i,area_id:300+i,area_name:`فضای ${floor}`,travel_seconds:8,reverse_seconds:null,lat:36.287,lon:59.615})) };
const center = [59.6161, 36.2888];
const portal = (floor, access_id, door_id) => ({ type:'Feature', geometry:{ type:'Point', coordinates:center }, properties:{ floor, access_id, door_id, id:access_id, is_open:true } });

async function clickPortal(page) {
  const map = page.locator('#map-container');
  const box = await map.boundingBox();
  await map.click({ position:{ x:box.width/2, y:box.height/2 } });
}

async function setup(page, { verifyPendingMap = false, conflictingGroup = false, ambiguousArea = false, sameFloorStair = false } = {}) {
  const writes=[]; const errors=[]; const candidateLookups=[]; const stairAreaLookups=[];
  let releaseStyle;
  const styleReady = verifyPendingMap ? new Promise(resolve => { releaseStyle = resolve; }) : Promise.resolve();
  page.on('pageerror',e => errors.push(e.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token','browser-fixture-only');
    localStorage.setItem('gp_admin_auth_store',JSON.stringify({state:{admin:{name:'مدیر آزمایشی'},roles:['admin'],permissions:['*']},version:0}));
  });
  await page.route('**/api/v1/**',async route => {
    const req=route.request(); const url=new URL(req.url()); const path=url.pathname;
    if (['POST','PUT'].includes(req.method()) && /connectors|doors|same-floor-stairs/.test(path)) writes.push({path,method:req.method(),body:req.postDataJSON()});
    let json={data:[],total:0};
    if (path.endsWith('/admin/auth/me')) json={id:1,name:'مدیر آزمایشی',roles:['super_dashboard_admin', 'manage_map'],roleTitles:[],permissions:[]};
    else if (path.endsWith('/floors')) json=floors;
    else if (path.endsWith('/connectors/candidates')) {
      candidateLookups.push(Object.fromEntries(url.searchParams));
      const area = sameFloorStair ? 200 + Number(url.searchParams.get('access_id')) : 300 + Number(url.searchParams.get('floor'));
      json = sameFloorStair && area === 309
        ? { area_id: null, areas: [{ id: 309, name: 'فضای بالای پله' }, { id: 310, name: 'فضای نامرتبط' }, { id: 311, name: 'فضای دو محدوده' }] }
        : ambiguousArea ? {area_id:null,areas:[{id:300,name:'فضای اول'},{id:301,name:'فضای دوم'}]} : {area_id:area,areas:[{id:area,name:'فضای تشخیص داده‌شده'}]};
    }
    else if (path.endsWith('/same-floor-stairs/candidates')) {
      stairAreaLookups.push(Object.fromEntries(url.searchParams));
      const endArea = url.searchParams.get('end_area_id');
      json = { areas: endArea === '310' ? [] : endArea === '311'
        ? [{ id: 1100795, floor: 0, name: 'پلهٔ اول' }, { id: 1100796, floor: 0, name: 'پلهٔ دوم' }]
        : [{ id: 1100794, floor: 0, name: 'راه پله دارالحجه' }] };
    }
    else if (path.endsWith('/same-floor-stairs')) json=req.method()==='GET'
      ? {data:[]}
      : {data:{...req.postDataJSON(),id:9,version:1}};
    else if (path.endsWith('/connectors/7') && req.method()==='GET') json=shared;
    else if (path.endsWith('/doors/299/info')) json={...shared.info, point:{ floor:0, door_id:299, access_id:199, lon:center[0], lat:center[1] }};
    else if (path.endsWith('/connectors') && req.method()==='GET') json=[{id:7,title:'آسانسور مشترک',kind:'elevator'}];
    else if (/connectors(?:\/7)?$/.test(path) && req.method()!=='GET') json={...req.postDataJSON(),id:7,version:4,stops:req.postDataJSON().stops.map((s,i)=>({...s,door_id:200+i,access_id:100+i}))};
    else if (path.endsWith('/graph-status')) json={graph:{status:'ready'}};
    await route.fulfill({json});
  });
  await page.route('**/map-styles/**/style*.json',async route=>{
    await styleReady;
    const features=conflictingGroup ? [portal(0,199,299)] : [portal(0,101,201),portal(-1,100,200),portal(sameFloorStair ? 0 : -1,109,209),portal(1,102,202)];
    await route.fulfill({json:{version:8,glyphs:'http://localhost:8080/glyphs/{fontstack}/{range}.pbf',
      sources:{door_access_points:{type:'geojson',data:{type:'FeatureCollection',features}}},
      layers:[{id:'background',type:'background',paint:{'background-color':'#f8f5f0'}},{id:'doors-access-point',type:'circle',source:'door_access_points',paint:{'circle-radius':10}}]}});
  });
  await page.route('**/tiles/**',route=>route.fulfill({status:204}));
  await page.goto('/#/admin');
  await page.getByText('مدیریت نقشه',{exact:true}).click();
  if (verifyPendingMap) {
    await expect(page.locator('.manage-door-point')).toHaveAttribute('aria-disabled','true');
    // Even a click dispatched before map readiness must not open the wrong wizard.
    await page.locator('.manage-door-point').dispatchEvent('click');
    await expect(page.locator('.add-place-btn')).toHaveCount(0);
    releaseStyle();
  }
  await expect(page.locator('.manage-door-point')).toHaveAttribute('aria-disabled','false');
  await page.locator('.manage-door-point').click();
  if (conflictingGroup) {
    await page.locator('.location-marker-controls .cancel-marker-btn').click();
    await clickPortal(page);
    await page.getByRole('button',{name:'ویرایش اطلاعات درب انتخاب‌شده'}).click();
  } else {
    await page.getByText('افزودن مکان روی نشانگر تنظیم شده',{exact:true}).click();
  }
  await expect(page.locator('.add-place-modal')).toBeVisible();
  return {writes,errors,candidateLookups,stairAreaLookups};
}

async function chooseType(page, name='آسانسور') {
  await page.locator('.step-content input.form-input').first().fill('اتصال آزمایشی');
  await page.locator('.step-content .add-place-combo-trigger').click();
  await page.getByRole('option',{name,exact:true}).click();
  await page.getByRole('button',{name:'تایید اطلاعات و مرحله بعد',exact:true}).click();
}

test('a stair within one floor looks up its area after both landings and saves the current match', async ({ page }) => {
  test.slow();
  const { writes, errors, candidateLookups, stairAreaLookups } = await setup(page, { sameFloorStair: true });
  await chooseType(page, 'پلهٔ داخل طبقه');
  await page.locator('.step2-content').getByText('فعال', { exact: true }).click();
  await page.locator('.step2-content').getByText('مسیر مناسب خانوادگی', { exact: true }).click();
  await expect(page.getByText('محدودهٔ پله', { exact: true })).toHaveCount(0);
  const stops = page.getByTestId('connector-stop');
  await expect(stops).toHaveCount(2);
  await expect(stops.nth(0)).toContainText('پایین پله');
  await expect(stops.nth(1)).toContainText('بالای پله');
  await expect(page.getByRole('button', { name: 'افزودن توقف در طبقه دیگر' })).toHaveCount(0);
  for (let index = 0; index < 2; index++) {
    const stop = stops.nth(index);
    await stop.getByRole('button', { name: 'انتخاب نقطه روی نقشه' }).click();
    await clickPortal(page);
    if (index === 0) {
      await stop.getByRole('button', { name: 'انتخاب یکی از ورودی‌های روی هم' }).click();
      await page.getByRole('option', { name: 'درب 201 · نقطهٔ 101' }).click();
      await expect(stop.getByTestId('connector-area-value')).toBeVisible();
    }
  }
  const upper = stops.nth(1);
  const chooseUpperArea = async (current, next) => {
    await upper.getByRole('button', { name: current, exact: true }).click();
    await page.getByRole('option', { name: next, exact: true }).click();
  };
  await expect(upper.getByRole('button', { name: 'فضای قابل‌تردد کنار نقطه', exact: true })).toBeVisible();
  expect(stairAreaLookups).toHaveLength(0);
  await chooseUpperArea('فضای قابل‌تردد کنار نقطه', 'فضای نامرتبط');
  await expect(page.getByTestId('connector-stops').getByRole('alert')).toContainText('دو نقطهٔ دسترسیِ پایین و بالای همان پله');
  await chooseUpperArea('فضای نامرتبط', 'فضای دو محدوده');
  await page.getByRole('button', { name: 'محدودهٔ سازگار با دو سر پله را انتخاب کنید', exact: true }).click();
  const matches = page.getByRole('listbox').getByRole('option');
  await expect(matches).toHaveCount(2);
  await page.getByRole('option', { name: 'پلهٔ دوم (1100796)', exact: true }).click();
  await expect(page.getByRole('button', { name: 'پلهٔ دوم (1100796)', exact: true })).toBeVisible();
  await chooseUpperArea('فضای دو محدوده', 'فضای بالای پله');
  await expect(page.getByText('راه پله دارالحجه (1100794)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'پلهٔ دوم (1100796)', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'از بالا به پایین', exact: true }).click();
  await page.getByLabel('زمان عبور از بالا به پایین').fill('12');
  await page.getByRole('button', { name: 'تایید اطلاعات و مرحله بعد', exact: true }).click();
  await expect(page.locator('.step3-content')).toContainText('محدودیت‌های زمانی و نماز از محدودهٔ پله و دو ورودی آن خوانده می‌شوند.');
  expect(writes).toHaveLength(0);
  await page.getByRole('button', { name: 'تایید اطلاعات و ثبت این مکان', exact: false }).click();
  await expect(page.locator('.add-place-modal')).toHaveCount(0);
  expect(candidateLookups.map(params => [params.floor, params.access_id])).toEqual([['0', '101'], ['0', '109']]);
  expect(stairAreaLookups).toEqual(['310', '311', '309'].map(end_area_id => ({
    floor: '0', start_access_id: '101', end_access_id: '109', start_area_id: '301', end_area_id
  })));
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ path: '/api/v1/admin/same-floor-stairs', method: 'POST', body: {
    stair_area_id: 1100794, kind: 'same_floor_stair', direction: 'reverse',
    stops: [{ floor: 0, access_id: 101, area_id: 301, reverse_seconds: 12 }, { floor: 0, access_id: 109, area_id: 309 }],
    info: { operational: { transport_modes: ['walk'] } }
  } });
  expect(writes[0].body.info).not.toHaveProperty('time_restrictions');
  expect(errors).toEqual([]);
});

test('a three-floor draft survives map picking and is saved atomically in the original wizard',async ({page},testInfo)=>{
  const {writes,errors,candidateLookups}=await setup(page);
  await expect(page.locator('.step-circle')).toHaveCount(3);
  await page.locator('.step-content .add-place-combo-trigger').click();
  await expect(page.getByRole('option',{name:'پله',exact:true})).toBeVisible();
  await expect(page.getByRole('option',{name:'رمپ',exact:true})).toBeVisible();
  await page.getByRole('option',{name:'آسانسور',exact:true}).click();
  await page.locator('.step-content input.form-input').first().fill('اتصال آزمایشی');
  await page.getByRole('button',{name:'تایید اطلاعات و مرحله بعد',exact:true}).click();
  await page.locator('.step2-content').getByText('فعال',{exact:true}).click();
  await page.locator('.step2-content').getByText('به صورت پیاده',{exact:true}).click();
  await page.locator('.step2-content').getByText('مسیر مناسب خانوادگی',{exact:true}).click();
  for (let i=0;i<=2;i++) {
    if (i) await page.getByRole('button',{name:'افزودن توقف در طبقه دیگر',exact:true}).click();
    await page.getByTestId('connector-stop').nth(i).getByRole('button',{name:'انتخاب نقطه روی نقشه',exact:true}).click();
    await expect(page.locator('.add-place-modal')).toHaveCount(0);
    if (i === 0) {
      await page.locator('#map-container').click({position:{x:250,y:250}});
      await expect(page.getByText('یکی از ورودی‌های مشخص‌شدهٔ همین طبقه را انتخاب کنید.',{exact:true})).toBeVisible();
      await expect(page.locator('.add-place-modal')).toHaveCount(0);
      expect(candidateLookups).toHaveLength(0);
    }
    await clickPortal(page);
    if (i === 1) {
      const stop = page.getByTestId('connector-stop').nth(i);
      const overlapping = stop.getByRole('button',{name:'انتخاب یکی از ورودی‌های روی هم'});
      await expect(overlapping).toBeVisible();
      await stop.getByRole('button',{name:'منفی ۱',exact:true}).click();
      await page.getByRole('option',{name:'طبقه ۱',exact:true}).click();
      await expect(overlapping).toHaveCount(0);
      await stop.getByRole('button',{name:'طبقه ۱',exact:true}).click();
      await page.getByRole('option',{name:'منفی ۱',exact:true}).click();
      await stop.getByRole('button',{name:'انتخاب نقطه روی نقشه',exact:true}).click();
      await clickPortal(page);
      await overlapping.click();
      await page.getByRole('option',{name:'درب 209 · نقطهٔ 109'}).click();
    }
    await expect(page.getByTestId('connector-stop').nth(i).getByTestId('connector-area-value')).toBeVisible();
  }
  expect(writes).toHaveLength(0);
  await expect(page.getByTestId('connector-stop')).toHaveCount(3);
  await page.getByTestId('connector-stop').first().getByRole('button',{name:'انتقال به بعد در ترتیب توقف‌ها',exact:true}).click();
  await expect(page.getByTestId('connector-stop').nth(1)).toContainText('همکف');
  await page.getByTestId('connector-stop').nth(1).getByRole('button',{name:'انتقال به قبل در ترتیب توقف‌ها',exact:true}).click();
  await page.locator('.connector-intro').scrollIntoViewIfNeeded();
  expect(await page.locator('.add-place-modal .modal-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.locator('.connector-map-button').first().evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Vazir');
  await page.locator('.modal-content').last().screenshot({path:testInfo.outputPath('connector-stops-desktop.png')});
  await page.getByRole('button',{name:'تایید اطلاعات و مرحله بعد',exact:true}).click();
  await expect(page.locator('.step3-content')).toBeVisible();
  await page.getByRole('button',{name:'تایید اطلاعات و ثبت این مکان',exact:false}).click();
  await expect(page.locator('.add-place-modal')).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0].body.stops.map(s=>s.floor)).toEqual([0,-1,1]);
  expect(writes[0].body.stops.map(s=>s.access_id)).toEqual([101,109,102]);
  expect(writes[0].body.stops.every(s=>!('lat' in s) && !('lon' in s))).toBe(true);
  expect(writes[0].body.info.basic_info.title.fa).toBe('اتصال آزمایشی');
  expect(errors).toEqual([]);
});

test('loading an existing shared elevator edits all stops and retains its version',async ({page})=>{
  const {writes,errors}=await setup(page); await chooseType(page);
  await page.getByRole('button',{name:'اتصال جدید؛ یا انتخاب اتصال موجود',exact:true}).click();
  await page.getByRole('option',{name:'آسانسور مشترک',exact:true}).click();
  await expect(page.getByTestId('connector-stop')).toHaveCount(3);
  await expect(page.getByTestId('connector-stop').first().getByRole('button',{name:'تغییر نقطه روی نقشه',exact:true})).toBeVisible();
  await page.getByTestId('connector-stop').first().getByRole('button',{name:'تغییر نقطه روی نقشه',exact:true}).click();
  await clickPortal(page);
  await page.getByRole('button',{name:'انتخاب یکی از ورودی‌های روی هم'}).click();
  await page.getByRole('option',{name:'درب 209 · نقطهٔ 109'}).click();
  await expect(page.getByTestId('connector-stop').first().getByTestId('connector-area-value')).toHaveText('فضای تشخیص داده‌شده');
  await page.getByRole('button',{name:'تایید اطلاعات و مرحله بعد',exact:true}).click();
  await page.getByRole('button',{name:'تایید اطلاعات و ثبت این مکان',exact:false}).click();
  await expect(page.locator('.add-place-modal')).toHaveCount(0);
  expect(writes).toHaveLength(1); expect(writes[0].method).toBe('PUT');
  expect(writes[0].body.version).toBe(3);
  expect(writes[0].body.stops.map(s=>s.access_id)).toEqual([109,101,102]);
  expect(writes[0].body.stops[0].floor).toBe(-1);
  expect(writes[0].body.stops[0]).not.toHaveProperty('lat');
  expect(errors).toEqual([]);
});

test('canceling map selection preserves the form and canceling the wizard writes nothing',async ({page},testInfo)=>{
  await page.setViewportSize({width:430,height:932});
  const {writes,errors}=await setup(page,{verifyPendingMap:true});
  await chooseType(page,'رمپ');
  await page.getByRole('button',{name:'افزودن توقف در طبقه دیگر',exact:true}).click();
  await page.getByTestId('connector-stop').nth(1).getByRole('button',{name:'انتخاب نقطه روی نقشه',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('connector-stop')).toHaveCount(2);
  await expect(page.locator('.step2-content')).toBeVisible();
  const box=await page.locator('.add-place-modal').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(431);
  await page.getByTestId('connector-stop').first().scrollIntoViewIfNeeded();
  expect(await page.locator('.add-place-modal .modal-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator('.add-place-modal').screenshot({path:testInfo.outputPath('connector-stops-mobile.png')});
  await page.getByRole('button',{name:'لغو و بازگشت',exact:true}).click();
  expect(writes).toHaveLength(0); expect(errors).toEqual([]);
});

test('a conflicting shared connector cannot replace the chosen point, while its ambiguous area remains editable',async ({page})=>{
  const {writes,errors}=await setup(page,{conflictingGroup:true,ambiguousArea:true});
  await page.locator('.add-place-modal .step-circle').nth(1).click();
  const selected=page.locator('[data-testid="connector-stop"][data-selected-point="true"]');
  await selected.getByRole('button',{name:'فضای قابل‌تردد کنار نقطه',exact:true}).click();
  await page.getByRole('option',{name:'فضای دوم',exact:true}).click();
  await page.getByRole('button',{name:'اتصال جدید؛ یا انتخاب اتصال موجود',exact:true}).click();
  await page.getByRole('option',{name:'آسانسور مشترک',exact:true}).click();
  await expect(page.getByText('این اتصال در طبقهٔ فعلی نقطهٔ دیگری دارد؛ برای ویرایش آن، همان نقطه را روی نقشه انتخاب کنید.',{exact:true})).toBeVisible();
  await expect(selected).toHaveCount(1);
  await expect(page.getByTestId('connector-stop')).toHaveCount(1);
  await expect(selected.getByRole('button',{name:'فضای دوم',exact:true})).toBeVisible();
  await expect(selected.getByRole('button',{name:'تغییر نقطه روی نقشه',exact:true})).toHaveCount(0);
  expect(writes).toHaveLength(0); expect(errors).toEqual([]);
});


test('admin map tooltips work on icon hover, keyboard focus and Escape without changing toolbar layout',async ({page})=>{
  const {writes,errors}=await setup(page);
  await page.getByRole('button',{name:'لغو و بازگشت',exact:true}).click();

  const map=page.locator('.map-management-section');
  const tooltip=page.getByRole('tooltip');
  const zoomIn=map.locator('.zoom-in');
  await expect(zoomIn).toHaveAttribute('aria-label','بزرگ‌نمایی نقشه');
  await zoomIn.hover();
  await expect(tooltip).toHaveText('بزرگ‌نمایی نقشه');
  await expect(zoomIn).toHaveAttribute('aria-describedby',/\S+/);

  // Tooltip is portaled to the document, so zoom-controls overflow never clips it.
  const tipBounds=await tooltip.boundingBox();
  const screen=page.viewportSize();
  expect(tipBounds.x).toBeGreaterThanOrEqual(0);
  expect(tipBounds.y).toBeGreaterThanOrEqual(0);
  expect(tipBounds.x+tipBounds.width).toBeLessThanOrEqual(screen.width+1);

  await page.keyboard.press('Escape');
  await expect(tooltip).toHaveCount(0);
  await expect(zoomIn).not.toHaveAttribute('aria-describedby',/\S+/);

  const group=map.locator('.area-mange');
  await group.focus();
  await expect(tooltip).toHaveText('مدیریت و ویرایش محدوده‌ها');
  await group.hover();
  await page.mouse.move(650, 380);
  await expect(tooltip).toHaveText('مدیریت و ویرایش محدوده‌ها');
  await page.keyboard.press('Enter');
  await expect(group).toHaveAttribute('aria-expanded','true');
  await expect(map.locator('.sub-buttons2')).toBeVisible();
  await map.locator('.sub-buttons2 .edit-area').hover();
  await expect(tooltip).toHaveText('ویرایش اطلاعات محدوده انتخاب‌شده');

  const layerMenu=map.locator('.map-type-display').first();
  await layerMenu.focus();
  await expect(tooltip).toHaveText('نمایش یا پنهان کردن فهرست لایه‌های نقشه');
  await expect(layerMenu).not.toHaveAttribute('aria-label',/./);
  await page.keyboard.press('Space');
  await expect(layerMenu).toHaveAttribute('aria-expanded','true');
  await expect(map.locator('.layers-dropdown')).toBeVisible();


  // A disabled native button still explains its purpose on hover.
  await map.locator('.temp-area-manage').click();
  const disabledMove=map.locator('.sub-buttons1 .move-temp-area');
  await expect(disabledMove).toBeDisabled();
  await disabledMove.hover();
  await expect(tooltip).toHaveText('جابجایی محدوده موقت انتخاب‌شده');

  // Every tooltip is a detached overlay; it never replaces the original buttons.
  expect(await map.locator('[data-map-tooltip]').count()).toBeGreaterThan(15);
  expect(writes).toHaveLength(0);
  expect(errors).toEqual([]);
});
