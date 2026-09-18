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
