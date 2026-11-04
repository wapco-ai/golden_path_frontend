import { test, expect } from '@playwright/test';

const floors = [
  { floor: 1, label: 'طبقه ۱', sort_order: 1 },
  { floor: 0, label: 'همکف', sort_order: 0 },
  { floor: -1, label: 'منفی ۱', sort_order: -1 }
];
// Identical names/XY are intentional. No images, contents or category required.
const pois = [-1, 0, 1].map((floor, index) => ({
  id: String(101 + index), floor, title: 'رواق آزمایشی بدون محتوا',
  coordinates: [36.287, 59.615], image: null, content: null,
  subGroupValue: `poi-${101 + index}`, subGroup: 'ravaq'
}));

async function setup(page) {
  const errors = [], searches = [], areaRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    sessionStorage.setItem('selectedMapType', 'base');
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    let json = { data: [], features: [], status: 'NO_MATCH' };
    if (url.pathname.endsWith('/floors')) json = floors;
    else if (url.pathname.endsWith('/groups/metadata')) json = { groups: [] };
    else if (url.pathname.endsWith('/groups/subgroups')) json = { subGroups: {} };
    else if (url.pathname.endsWith('/landmark-places')) {
      const searching = Boolean(url.searchParams.get('search'));
      if (searching) searches.push(Object.fromEntries(url.searchParams));
      json = { places: { landmarkPlaces: searching ? pois : [] } };
    } else if (url.pathname.endsWith('/area-doors')) areaRequests.push(Object.fromEntries(url.searchParams));
    await route.fulfill({ json });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }]
  } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  return { errors, searches, areaRequests };
}

for (const width of [360, 1280]) {
  for (const target of ['origin', 'destination']) {
    test(`${width}px ${target} search hides the floor picker and restores it for map selection`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 850 });
      const { errors, searches } = await setup(page);
      await page.goto('/#/mpr');
      const picker = page.locator('.gp-floor-trigger');
      await expect(picker).toBeVisible();
      await page.locator(target === 'origin' ? '.map-current-location' : '.map-destination-input-wrapper').click();
      const modal = page.locator('.map-search-modal');
      await expect(modal).toBeVisible();
      await expect(picker).toBeHidden();
      await expect(page.getByRole('button', { name: /^طبقهٔ نقشه:/ })).toHaveCount(0);
      await modal.locator('input').fill('رواق آزمایشی');
      const rows = page.locator('.map-destination-list li');
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText('منفی');
      await expect(rows.nth(1)).toContainText('همکف');
      await expect(rows.nth(2)).toContainText('۱');
      await expect(picker).toBeHidden();
      expect(searches.at(-1).floor).toBeUndefined();
      expect(searches.at(-1).featured).toBeUndefined();
      await page.screenshot({ path: testInfo.outputPath(`search-${target}-${width}.png`) });

      await modal.locator('input').fill('');
      await page.locator('.map-option-item').first().click();
      await expect(modal).toHaveCount(0);
      await expect(picker).toBeVisible();
      await picker.click();
      await page.locator('.gp-floor-option').filter({ hasText: 'منفی ۱' }).click();
      await expect(picker).toContainText('منفی ۱');
      await page.locator('.map-back-button').click();
      await expect(modal).toBeVisible();
      await expect(picker).toBeHidden();
      await page.locator('.map-modal-back-button').click();
      await expect(modal).toHaveCount(0);
      await expect(picker).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}

test('contentless POI search retains the independent negative origin and positive destination floors', async ({ page }) => {
  const { errors, areaRequests } = await setup(page);
  await page.goto('/#/mpr');
  await page.locator('.map-current-location').click();
  await page.locator('.map-search-modal input').fill('رواق آزمایشی');
  await expect(page.locator('.map-destination-list li')).toHaveCount(3);
  await page.locator('.map-destination-list li').first().click();
  await expect(page.locator('.map-current-location input')).toHaveValue(/منفی/);
  await page.locator('.map-destination-input-wrapper').click();
  await expect(page.locator('.gp-floor-trigger')).toBeHidden();
  await page.locator('.map-search-modal input').fill('رواق آزمایشی');
  await expect(page.locator('.map-destination-list li')).toHaveCount(3);
  await page.locator('.map-destination-list li').last().click();
  await expect.poll(() => areaRequests.at(-1)?.floor).toBe('1');
  await expect(page.locator('.map-current-location input')).toHaveValue(/منفی/);
  expect(errors).toEqual([]);
});

test('MPB text results also hide the map floor picker without requiring POI images', async ({ page }) => {
  const { errors } = await setup(page);
  await page.goto('/#/mpb');
  const picker = page.locator('.gp-floor-trigger');
  await expect(picker).toBeVisible();
  const input = page.locator('.gp-mapbegin input').first();
  await input.fill('رواق آزمایشی');
  await expect(page.locator('.search-modal3')).toBeVisible();
  await expect(picker).toBeHidden();
  await expect(page.locator('.search-result-card3')).toHaveCount(3);
  await input.fill('');
  await expect(page.locator('.search-modal3')).toHaveCount(0);
  await expect(picker).toBeVisible();
  expect(errors).toEqual([]);
});

for (const target of ['origin', 'destination']) {
  test(`${target} search keeps each address with its own POI across ordering and language`, async ({ page }) => {
    const { errors } = await setup(page);
    let reversed = false;
    await page.route('**/api/v1/landmark-places**', (route) => {
      const url = new URL(route.request().url());
      if (!url.searchParams.has('search')) return route.fulfill({ json: { places: { landmarkPlaces: [] } } });
      const items = [
        { id: '501', title: 'مکان الف', subGroupValue: 'shared', subGroup: 'عنوان نامرتبط', address: { fa: 'نشانی الف', en: 'Address A' }, floor: -1, coordinates: [36.287, 59.615] },
        { id: '502', title: 'مکان ب', subGroupValue: 'shared', subGroup: 'عنوان نامرتبط', address: { fa: 'نشانی ب', en: 'Address B' }, floor: 1, coordinates: [36.288, 59.616] },
        { id: '503', title: 'مکان بی نشانی', subGroupValue: 'shared', subGroup: 'عنوان نامرتبط', floor: 0, coordinates: [36.289, 59.617] }
      ];
      return route.fulfill({ json: { places: { landmarkPlaces: reversed ? items.reverse() : items } } });
    });
    await page.goto('/#/mpr');
    await page.locator(target === 'origin' ? '.map-current-location' : '.map-destination-input-wrapper').click();
    const input = page.locator('.map-search-modal input');
    await input.fill('مکان');
    const rows = page.locator('.map-destination-list li');
    await expect(rows).toHaveCount(3);
    const rowA = rows.filter({ hasText: 'مکان الف' });
    const rowB = rows.filter({ has: page.locator('.map-destination-name', { hasText: /^مکان ب$/ }) });
    const missing = rows.filter({ hasText: 'مکان بی نشانی' });
    await expect(rowA.locator('.map-destination-location')).toContainText('نشانی الف');
    await expect(rowA).toContainText('منفی');
    await expect(rowB.locator('.map-destination-location')).toContainText('نشانی ب');
    await expect(rowB).toContainText('۱');
    await expect(missing).not.toContainText('عنوان نامرتبط');
    reversed = true;
    await input.fill('مکان ب');
    await expect(rows.first()).toContainText('مکان بی نشانی');
    await expect(rowA.locator('.map-destination-location')).toContainText('نشانی الف');
    await expect(rowB.locator('.map-destination-location')).toContainText('نشانی ب');
    await page.evaluate(async () => { const { useLangStore } = await import('/src/store/langStore.js'); useLangStore.getState().setLanguage('en'); });
    await expect(rowA.locator('.map-destination-location')).toContainText('Address A');
    await expect(rowB.locator('.map-destination-location')).toContainText('Address B');
    await rowB.click();
    if (target === 'origin') await expect(page.locator('.map-current-location input')).toHaveValue(/مکان ب/);
    else await expect(page.locator('.map-entry-location-name')).toContainText('مکان ب');
    expect(errors).toEqual([]);
  });
}

test('legacy recent searches retain entries and recover only their own saved addresses', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('recent-search-storage', JSON.stringify({ version: 1, state: { recentSearches: [
    { id: '501', name: 'مکان الف', location: 'عنوان اشتباه مشترک', address: 'نشانی الف', floor: -1, coordinates: [36.287, 59.615] },
    { id: 'shared', name: 'مکان بدون نشانی', location: 'عنوان اشتباه مشترک', floor: 1, coordinates: [36.288, 59.616] }
  ] } })));
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  const rows = page.locator('.map-destination-list li');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('.map-destination-location')).toContainText('نشانی الف');
  await expect(rows.nth(1)).not.toContainText('عنوان اشتباه مشترک');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('recent-search-storage')));
  expect(saved.state.recentSearches).toHaveLength(2);
  expect(saved.state.recentSearches[0].coordinates).toEqual([36.287, 59.615]);
  expect(JSON.stringify(saved)).not.toContain('عنوان اشتباه مشترک');
});

test('recent POI addresses refresh in the selected language by entity ID', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('recent-search-storage', JSON.stringify({ version: 2, state: { recentSearches: [
    { id: '501', poiId: '501', name: 'مکان الف', address: 'نشانی الف', location: 'نشانی الف', addressLanguage: 'fa', floor: 0, coordinates: [36.287, 59.615] }
  ] } })));
  const lookups = [];
  await page.route('**/api/v1/landmark-places**', (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('poi_id')) {
      lookups.push([url.searchParams.get('poi_id'), url.searchParams.get('language')]);
      return route.fulfill({ json: { places: { landmarkPlaces: [{ id: '501', address: 'Address A' }] } } });
    }
    return route.fulfill({ json: { places: { landmarkPlaces: [] } } });
  });
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  await expect(page.locator('.map-destination-list li')).toContainText('نشانی الف');
  await page.evaluate(async () => { const { useLangStore } = await import('/src/store/langStore.js'); useLangStore.getState().setLanguage('en'); });
  await expect(page.locator('.map-destination-list li')).toContainText('Address A');
  expect(lookups).toContainEqual(['501', 'en']);
});

test('subgroup selection keeps the selected metadata when values coincide', async ({ page }) => {
  await setup(page);
  await page.route('**/api/v1/groups/metadata**', route => route.fulfill({ json: { groups: [{ value: 'testgroup', label: { fa: 'گروه آزمایش' } }] } }));
  await page.route('**/api/v1/groups/subgroups**', route => route.fulfill({ json: { subGroups: { testgroup: [
    { value: 'shared', label: { fa: 'زیرگروه اول' }, address: { fa: 'نشانی اول' }, floor: 0, coordinates: [36.287, 59.615] },
    { value: 'shared', label: { fa: 'زیرگروه دوم' }, address: { fa: 'نشانی دوم' }, floor: 1, coordinates: [36.288, 59.616] }
  ] } } }));
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  await page.locator('.map-category-item2').filter({ hasText: 'گروه آزمایش' }).click();
  const choices = page.locator('.subgroup-search-item');
  await expect(choices).toHaveCount(2);
  await expect(choices.nth(0)).toContainText('زیرگروه اول');
  await expect(choices.nth(1)).toContainText('زیرگروه دوم');
  await choices.nth(1).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('recent-search-storage'))?.state?.recentSearches?.[0]?.location)).toBe('نشانی دوم');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('recent-search-storage')).state.recentSearches[0]);
  expect(saved.name).toBe('زیرگروه دوم');
  expect(saved.floor).toBe(1);
});

for (const target of ['origin', 'destination']) {
  test(`${target} search hides repeated titles while retaining useful addresses and real floors`, async ({ page }) => {
    await setup(page);
    await page.route('**/api/v1/landmark-places**', (route) => {
      const url = new URL(route.request().url());
      const items = [
        { id: '201', title: 'چایخانه کوثر', address: '  چایخانه   كوثر  ', floor: 0, coordinates: [36.287, 59.615] },
        { id: '202', title: 'چایخانه غدیر', address: 'صحن غدیر، ضلع غربی', floor: 1, coordinates: [36.288, 59.616] },
        { id: '203', title: 'چایخانه رضوان', address: 'چایخانه رضوان', floor: null, coordinates: [36.289, 59.617] },
        { id: '204', title: 'چایخانه دیگر', address: '', floor: -1, coordinates: [36.290, 59.618] }
      ];
      return route.fulfill({ json: { places: { landmarkPlaces: url.searchParams.has('search') ? items : [] } } });
    });
    await page.goto('/#/mpr');
    await page.locator(target === 'origin' ? '.map-current-location' : '.map-destination-input-wrapper').click();
    await page.locator('.map-search-modal input').fill('چایخانه');
    const rows = page.locator('.map-destination-list li');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0).locator('.map-destination-location')).toHaveText('همکف');
    await expect(rows.nth(1).locator('.map-destination-location')).toContainText('صحن غدیر، ضلع غربی');
    await expect(rows.nth(1).locator('.map-destination-location')).toContainText('طبقه');
    await expect(rows.nth(2).locator('.map-destination-location')).toBeEmpty();
    await expect(rows.nth(3).locator('.map-destination-location')).toHaveText('طبقهٔ منفی ۱');
  });
}

test('recent search hides only the repeated address without altering stored data', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => localStorage.setItem('recent-search-storage', JSON.stringify({ version: 2, state: { recentSearches: [
    { id: '201', poiId: '201', name: 'چایخانه کوثر', location: 'چایخانه کوثر', address: 'چایخانه کوثر', addressLanguage: 'fa', floor: 0, coordinates: [36.287, 59.615] },
    { id: '202', poiId: '202', name: 'چایخانه غدیر', location: 'صحن غدیر', address: 'صحن غدیر', addressLanguage: 'fa', floor: 1, coordinates: [36.288, 59.616] }
  ] } })));
  await page.goto('/#/mpr');
  await page.locator('.map-destination-input-wrapper').click();
  const rows = page.locator('.map-destination-list li');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator('.map-destination-location')).toHaveText('همکف');
  await expect(rows.nth(1).locator('.map-destination-location')).toContainText('صحن غدیر');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('recent-search-storage')).state.recentSearches);
  expect(stored[0].address).toBe('چایخانه کوثر');
  expect(stored[0].coordinates).toEqual([36.287, 59.615]);
});
