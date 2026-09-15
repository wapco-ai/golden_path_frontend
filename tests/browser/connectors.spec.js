import { test, expect } from '@playwright/test';

const floors = [-1,0,1].map(floor => ({floor,label:floor === 0 ? 'همکف' : floor === -1 ? 'منفی ۱' : 'طبقه ۱'}));
const shared = { id:7,version:3,kind:'elevator',direction:'both',wait_seconds:20,
  info:{basic_info:{title:{fa:'آسانسور مشترک'},description:'توضیح مشترک'},operational:{place_function:'elevator',status:'active',transport_modes:['walk','wheelchair'],gender_access:['both']}},
  stops: floors.map(({floor},i) => ({floor,access_id:100+i,door_id:200+i,area_id:300+i,area_name:`فضای ${floor}`,travel_seconds:8,reverse_seconds:null,lat:36.287,lon:59.615})) };

async function setup(page) {
  const writes=[]; const errors=[];
  page.on('pageerror',e => errors.push(e.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token','browser-fixture-only');
    localStorage.setItem('gp_admin_auth_store',JSON.stringify({state:{admin:{name:'مدیر آزمایشی'},roles:['admin'],permissions:['*']},version:0}));
  });
  await page.route('**/api/v1/**',async route => {
    const req=route.request(); const url=new URL(req.url()); const path=url.pathname;
    if (['POST','PUT'].includes(req.method()) && /connectors|doors/.test(path)) writes.push({path,method:req.method(),body:req.postDataJSON()});
    let json={data:[],total:0};
    if (path.endsWith('/floors')) json=floors;
    else if (path.endsWith('/connectors/candidates')) json={area_id:300+Number(url.searchParams.get('floor')),areas:[{id:300+Number(url.searchParams.get('floor')),name:'فضای تشخیص داده‌شده'}]};
    else if (path.endsWith('/connectors/7') && req.method()==='GET') json=shared;
    else if (path.endsWith('/connectors') && req.method()==='GET') json=[{id:7,title:'آسانسور مشترک',kind:'elevator'}];
    else if (/connectors(?:\/7)?$/.test(path) && req.method()!=='GET') json={...req.postDataJSON(),id:7,version:4,stops:req.postDataJSON().stops.map((s,i)=>({...s,door_id:200+i,access_id:100+i}))};
    else if (path.endsWith('/graph-status')) json={graph:{status:'ready'}};
    await route.fulfill({json});
  });
  await page.route('**/map-styles/**/style*.json',route=>route.fulfill({json:{version:8,glyphs:'http://localhost:8080/glyphs/{fontstack}/{range}.pbf',sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#f8f5f0'}}]}}));
  await page.route('**/tiles/**',route=>route.fulfill({status:204}));
  await page.goto('/#/admin');
  await page.getByText('مدیریت نقشه',{exact:true}).click();
  await page.locator('.manage-door-point').click();
  await page.getByText('افزودن مکان روی نشانگر تنظیم شده',{exact:true}).click();
  await expect(page.locator('.add-place-modal')).toBeVisible();
  return {writes,errors};
}

async function chooseType(page, name='آسانسور') {
  await page.locator('.step-content input.form-input').first().fill('اتصال آزمایشی');
  await page.locator('.step-content .add-place-combo-trigger').click();
  await page.getByRole('option',{name,exact:true}).click();
  await page.getByRole('button',{name:'تایید اطلاعات و مرحله بعد',exact:true}).click();
}

test('a three-floor draft survives map picking and is saved atomically in the original wizard',async ({page},testInfo)=>{
  const {writes,errors}=await setup(page);
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
  for (let i=1;i<=2;i++) {
    await page.getByRole('button',{name:'افزودن توقف در طبقه دیگر',exact:true}).click();
    await page.getByTestId('connector-stop').nth(i).getByRole('button',{name:'انتخاب نقطه روی نقشه',exact:true}).click();
    await expect(page.locator('.add-place-modal')).toHaveCount(0);
    await page.locator('#map-container').click({position:{x:500+i*20,y:350}});
    await expect(page.getByTestId('connector-stop').nth(i).getByText('فضای دسترسی:',{exact:false})).toBeVisible();
  }
  expect(writes).toHaveLength(0);
  await expect(page.getByTestId('connector-stop')).toHaveCount(3);
  await page.getByTestId('connector-stop').nth(1).scrollIntoViewIfNeeded();
  expect(await page.locator('.add-place-modal .modal-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator('.modal-content').last().screenshot({path:testInfo.outputPath('connector-stops-desktop.png')});
  await page.getByRole('button',{name:'تایید اطلاعات و مرحله بعد',exact:true}).click();
  await expect(page.locator('.step3-content')).toBeVisible();
  await page.getByRole('button',{name:'تایید اطلاعات و ثبت این مکان',exact:false}).click();
  await expect(page.locator('.add-place-modal')).toHaveCount(0);
  expect(writes).toHaveLength(1);
  expect(writes[0].body.stops.map(s=>s.floor)).toEqual([0,-1,1]);
  expect(writes[0].body.info.basic_info.title.fa).toBe('اتصال آزمایشی');
  expect(errors).toEqual([]);
});

test('loading an existing shared elevator edits all stops and retains its version',async ({page})=>{
  const {writes,errors}=await setup(page); await chooseType(page);
  await page.getByRole('button',{name:'اتصال جدید؛ یا انتخاب اتصال موجود',exact:true}).click();
  await page.getByRole('option',{name:'آسانسور مشترک',exact:true}).click();
  await expect(page.getByTestId('connector-stop')).toHaveCount(3);
  await page.getByRole('button',{name:'تایید اطلاعات و مرحله بعد',exact:true}).click();
  await page.getByRole('button',{name:'تایید اطلاعات و ثبت این مکان',exact:false}).click();
  await expect(page.locator('.add-place-modal')).toHaveCount(0);
  expect(writes).toHaveLength(1); expect(writes[0].method).toBe('PUT');
  expect(writes[0].body.version).toBe(3);
  expect(writes[0].body.stops.map(s=>s.access_id)).toEqual([100,101,102]);
  expect(errors).toEqual([]);
});

test('canceling map selection preserves the form and canceling the wizard writes nothing',async ({page},testInfo)=>{
  const {writes,errors}=await setup(page);
  await page.setViewportSize({width:430,height:932});
  await chooseType(page,'رمپ');
  await page.getByRole('button',{name:'افزودن توقف در طبقه دیگر',exact:true}).click();
  await page.getByTestId('connector-stop').nth(1).getByRole('button',{name:'انتخاب نقطه روی نقشه',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('connector-stop')).toHaveCount(2);
  await expect(page.locator('.step2-content')).toBeVisible();
  const box=await page.locator('.add-place-modal').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(431);
  await page.getByTestId('connector-stop').nth(1).scrollIntoViewIfNeeded();
  expect(await page.locator('.add-place-modal .modal-content').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.locator('.add-place-modal').screenshot({path:testInfo.outputPath('connector-stops-mobile.png')});
  await page.getByRole('button',{name:'لغو و بازگشت',exact:true}).click();
  expect(writes).toHaveLength(0); expect(errors).toEqual([]);
});
