import { test, expect } from '@playwright/test';

async function setup(page, { profile = {}, language = 'fa', responses = [], failRefresh = false } = {}) {
  let writes = 0;
  let saved = null;
  const initial = { id: 41, phone: '09121234567', firstName: '', lastName: '', email: '', nationalId: '', birthDate: '', profileCompleted: false, ...profile };
  await page.addInitScript(({ user, lang }) => {
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: lang }, version: 1 }));
    localStorage.setItem('gp_user_auth_store', JSON.stringify({ state: { accessToken: 'test-access', refreshToken: 'test-refresh', user }, version: 0 }));
    localStorage.setItem('gp_user_refresh_token', 'test-refresh');
    sessionStorage.setItem('gp_user_access_token', 'test-access');
  }, { user: initial, lang: language });
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/users/me') && route.request().method() === 'PATCH') {
      writes++;
      const response = responses[writes - 1];
      if (response) return route.fulfill(response);
      saved = { ...initial, ...route.request().postDataJSON(), profileCompleted: true };
      return route.fulfill({ json: saved });
    }
    if (url.pathname.endsWith('/auth/me') && failRefresh) return route.fulfill({ status: 503, json: {} });
    if (url.pathname.endsWith('/users/me') || url.pathname.endsWith('/auth/me')) return route.fulfill({ json: saved || initial });
    return route.fulfill({ json: {} });
  });
  await page.goto('/#/pinfo');
  await expect(page.locator('.submit-button')).toBeEnabled();
  return { writes: () => writes, saved: () => saved };
}

async function chooseDate(page) {
  const previous = await page.locator('#profile-birthDate').inputValue();
  await page.locator('#profile-birthDate').click();
  const day = page.locator('.rmdp-day:not(.rmdp-disabled):not(.rmdp-deactive) span:not(:empty)').nth(1);
  await expect(day).toBeVisible();
  await day.click();
  await expect(page.locator('#profile-birthDate')).not.toHaveValue(previous);
}

for (const language of ['fa', 'en']) {
  test(`${language}: incomplete and whitespace fields retain accessible errors until corrected`, async ({ page }) => {
    const api = await setup(page, { language });
    const submit = page.locator('.submit-button');
    await submit.click();
    await expect(page.locator('#profile-firstName')).toBeFocused();
    for (const field of ['firstName', 'lastName', 'email', 'nationalId', 'birthDate']) {
      const input = page.locator(`#profile-${field}`);
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAttribute('aria-describedby', `profile-${field}-error`);
      await expect(page.locator(`#profile-${field}-error`)).toBeVisible();
    }
    await expect(page.locator('.phone-input')).toHaveAttribute('readonly', '');
    await page.locator('#profile-firstName').fill('   ');
    await page.locator('#profile-lastName').fill('   ');
    await submit.click();
    await expect(page.locator('#profile-firstName')).toBeFocused();
    await page.waitForTimeout(3200);
    await expect(page.locator('#profile-firstName-error')).toBeVisible();
    expect(api.writes()).toBe(0);
    await page.locator('#profile-firstName').fill('Ali');
    await expect(page.locator('#profile-firstName-error')).toHaveCount(0);
    await submit.click();
    await expect(page.locator('#profile-lastName')).toBeFocused();
    await page.locator('#profile-lastName').fill('Reza');
    await page.locator('#profile-email').fill('   ');
    await page.locator('#profile-nationalId').fill('   ');
    await submit.click();
    await expect(page.locator('#profile-email')).toBeFocused();
    await expect(page.locator('#profile-email-error')).toBeVisible();
    await expect(page.locator('#profile-nationalId-error')).toBeVisible();
    expect(api.writes()).toBe(0);
    await page.locator('#profile-nationalId').fill('1234567890');
    await expect(page.locator('#profile-email-error')).toHaveCount(0);
    await expect(page.locator('#profile-nationalId-error')).toHaveCount(0);
    await submit.click();
    await expect(page.locator('#profile-birthDate')).toBeFocused();
    expect(api.writes()).toBe(0);
    await chooseDate(page);
    await expect(page.locator('#profile-birthDate-error')).toHaveCount(0);
    await submit.click();
    await expect.poll(api.writes).toBe(1);
    await expect.poll(() => api.saved()?.nationalId).toBe('1234567890');
  });
}

test('422 errors stay associated with fields and correct independently before successful save', async ({ page }) => {
  const api = await setup(page, { language: 'en', profile: { firstName: 'Ali', lastName: 'Reza', email: 'bad', nationalId: '123', birthDate: '2000-01-01' }, responses: [
    { status: 422, json: { message: 'Invalid', errors: { email: ['Invalid email'], nationalId: ['The national id field must be at least 8 characters.'], birthDate: ['Invalid date'], address: { province: ['Invalid province'] } } } }
  ] });
  const submit = page.locator('.submit-button');
  await submit.click();
  await expect(page.locator('#profile-email')).toBeFocused();
  await expect(page.locator('#profile-email-error')).toContainText('valid email');
  await expect(page.locator('#profile-birthDate')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#profile-birthDate')).toHaveAttribute('aria-describedby', 'profile-birthDate-error');
  await expect(page.locator('#profile-province-error')).toBeVisible();
  await expect(page.locator('#profile-nationalId-error')).toContainText('at least 8');
  await page.waitForTimeout(3200);
  await page.locator('#profile-email').fill('stillbad');
  await expect(page.locator('#profile-email-error')).toBeVisible();
  await page.locator('#profile-email').fill('valid@example.com');
  await expect(page.locator('#profile-email-error')).toHaveCount(0);
  await expect(page.locator('#profile-birthDate-error')).toBeVisible();
  await page.locator('#profile-nationalId').fill('1234');
  await expect(page.locator('#profile-nationalId-error')).toBeVisible();
  await page.locator('#profile-nationalId').fill('1234567890');
  await expect(page.locator('#profile-nationalId-error')).toHaveCount(0);
  await chooseDate(page);
  await expect(page.locator('#profile-birthDate-error')).toHaveCount(0);
  await page.locator('#profile-province').focus();
  await page.locator('.dropdown-item').first().click();
  await expect(page.locator('#profile-province-error')).toHaveCount(0);
  await submit.click();
  await expect.poll(api.writes).toBe(2);
  await expect.poll(() => api.saved()?.email).toBe('valid@example.com');
});

test('unmapped server validation and general failures produce persistent localized messages', async ({ page }) => {
  const api = await setup(page, { language: 'en', profile: { firstName: 'Ali', lastName: 'Reza', email: 'valid@example.com', birthDate: '2000-01-01' }, responses: [
    { status: 422, json: { errors: { 'address.postalCode': ['Invalid'] } } },
    { status: 500, json: { message: 'Server error' } }
  ] });
  const submit = page.locator('.submit-button');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('invalid');
  await page.waitForTimeout(3200);
  await expect(page.getByRole('alert')).toBeVisible();
  await submit.click();
  await expect(page.getByRole('alert')).toContainText('Could not save');
  expect(api.writes()).toBe(2);
});


test('a saved profile followed by a failed refresh is reported accurately', async ({ page }) => {
  const api = await setup(page, { language: 'en', failRefresh: true, profile: { firstName: 'Ali', lastName: 'Reza', email: 'valid@example.com', birthDate: '2000-01-01' } });
  await page.locator('.submit-button').click();
  await expect(page.getByRole('alert')).toContainText('was saved');
  expect(api.writes()).toBe(1);
});
