import { test, expect } from '@playwright/test';

const oldGeo = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[59.61, 36.28], [59.62, 36.29]] } };
const freshGeo = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[59.61, 36.28], [59.63, 36.30]] } };
const routes = [1, 2].map(id => ({
  id, mode: 'walk', gender: 'both', timestamp: '2025-01-01T12:00:00Z',
  origin: { name: `Origin ${id}`, coordinates: [36.28, 59.61], floor: 0 },
  destination: { name: `Destination ${id}`, coordinates: [36.29, 59.62], floor: 0 },
  route: { geo: oldGeo, steps: [], alternatives: [] }
}));

async function setup(page, onRouting) {
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_user_access_token', 'test-token');
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/route-history')) return route.fulfill({ json: { data: routes } });
    if (path.endsWith('/routing/route')) return onRouting(route);
    return route.fulfill({ json: { data: [], groups: [], features: [] } });
  });
  await page.goto('/#/proutes');
  await expect(page.locator('.repeat-route-btn')).toHaveCount(2);
}

test('repeat shows pending state, rejects duplicate clicks, and stores the new route', async ({ page }) => {
  let release;
  const responseReady = new Promise(resolve => { release = resolve; });
  let count = 0;
  await setup(page, async route => {
    count++;
    await responseReady;
    await route.fulfill({ json: { geo: freshGeo, steps: [], alternatives: [] } });
  });

  await page.locator('.repeat-route-btn').first().evaluate(button => {
    button.click();
    button.click();
  });
  await expect(page.locator('.route-request-loader')).toBeVisible();
  await expect(page.locator('.repeat-route-btn').first()).toBeDisabled();
  await expect(page.locator('.repeat-route-btn').last()).toBeDisabled();
  expect(count).toBe(1);
  release();
  await expect(page).toHaveURL(/#\/rop$/);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('routeGeo')))).toEqual(freshGeo);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('route-storage')).state);
  expect(stored.routeGeo).toEqual(freshGeo);
  expect(stored.origin.name).toBe('Origin 1');
  expect(count).toBe(1);
});

test('failure displays an error and allows retry', async ({ page }) => {
  let count = 0;
  await setup(page, async route => {
    count++;
    if (count === 1) return route.fulfill({ status: 503, body: 'unavailable' });
    return route.fulfill({ json: { geo: freshGeo, steps: [], alternatives: [] } });
  });
  await page.locator('.repeat-route-btn').first().click();
  await expect(page.locator('.Toastify__toast--error')).toBeVisible();
  await expect(page.locator('.route-request-loader')).toHaveCount(0);
  await expect(page.locator('.repeat-route-btn').first()).toBeEnabled();
  await expect(page).toHaveURL(/#\/proutes$/);
  await page.locator('.repeat-route-btn').first().click();
  await expect(page).toHaveURL(/#\/rop$/);
  expect(count).toBe(2);
});

test('previous route still opens the saved snapshot without a routing request', async ({ page }) => {
  let count = 0;
  await setup(page, async route => {
    count++;
    await route.fulfill({ status: 500 });
  });
  await page.locator('.repeat-prev-btn').first().click();
  await expect(page).toHaveURL(/#\/rop$/);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('routeGeo')))).toEqual(oldGeo);
  expect(count).toBe(0);
});
