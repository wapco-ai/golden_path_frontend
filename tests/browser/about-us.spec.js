import { test, expect } from '@playwright/test';

const setup = async (page, { unavailable = false } = {}) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('lang-storage', JSON.stringify({
      state: { language: 'fa' }, version: 1
    }));
  });
  await page.route('**/api/v1/pages/about**', async (route) => {
    requests.push(new URL(route.request().url()));
    if (unavailable) {
      await route.fulfill({ status: 503, json: { message: 'Temporarily unavailable' } });
    } else {
      await route.fulfill({
        json: {
          type: 'about',
          title: 'درباره ما - آزمایش',
          description: 'این متن آزمایشی از سرویس درباره ما دریافت شده است.',
          phones: [],
          emails: []
        }
      });
    }
  });
  await page.route('**/api/v1/pages/contact**', route => route.fulfill({
    json: { type: 'contact', title: 'تماس با ما', description: 'اطلاعات تماس', phones: [], emails: [], address: '' }
  }));
  return { errors, requests };
};

test('About Us opens from its existing hash route and renders the server content without JavaScript errors', async ({ page }) => {
  const { errors, requests } = await setup(page);
  await page.goto('/#/aboutus');
  await expect(page.locator('.aboutus-page-container')).toBeVisible();
  await expect(page.locator('.aboutus-title')).toHaveText('درباره ما - آزمایش');
  await expect(page.locator('.aboutus-description-text')).toHaveText(
    'این متن آزمایشی از سرویس درباره ما دریافت شده است.'
  );
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(requests.every(url => url.searchParams.get('lang') === 'fa')).toBe(true);
  expect(errors).toEqual([]);

  await page.locator('.aboutus-cta-button').click();
  await expect(page).toHaveURL(/#\/contactus$/);
  await expect(page.locator('.contactus-page-container')).toBeVisible();
  expect(errors).toEqual([]);
});

test('About Us remains visible with existing localized fallback if the public API is unavailable', async ({ page }) => {
  const { errors, requests } = await setup(page, { unavailable: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/aboutus');
  await expect(page.locator('.aboutus-page-container')).toBeVisible();
  await expect(page.locator('.aboutus-title')).toHaveText('درباره ما');
  await expect(page.locator('.aboutus-description-text')).toContainText('ما یک تیم');
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
