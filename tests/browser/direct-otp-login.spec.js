import { test, expect } from '@playwright/test';

const phone = '09121234567';
const user = { id: 41, phone, firstName: '', lastName: '', profileCompleted: false };
const session = { accessToken: 'local-access', refreshToken: 'local-refresh', expiresIn: 3600, user };
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

async function setup(page, options = {}) {
  const calls = { request: [], verify: [], me: [], refresh: [], protected: [], external: [] };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript((oldSession) => {
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
    if (oldSession) {
      localStorage.setItem('gp_user_auth_store', JSON.stringify({ state: oldSession, version: 0 }));
      localStorage.setItem('gp_user_refresh_token', oldSession.refreshToken);
      sessionStorage.setItem('gp_user_access_token', oldSession.accessToken);
    }
  }, options.oldSession || null);
  // Tests exercise only the local application's public contract; no employer call is made.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === '5173') return route.continue();
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ contentType: 'text/css', body: '' });
    if (url.hostname !== 'localhost' || url.port !== '8080') {
      calls.external.push(url.origin);
      return route.abort();
    }
    const request = route.request();
    const record = { body: request.postDataJSON(), authorization: request.headers().authorization };
    if (url.pathname.endsWith('/auth/otp/request')) {
      calls.request.push(record);
      if (options.request) return options.request(route, calls.request.length);
      return route.fulfill({ json: { otpLength: 4, retryAfter: 2, expiresIn: 120 } });
    }
    if (url.pathname.endsWith('/auth/otp/verify')) {
      calls.verify.push(record);
      if (options.verify) return options.verify(route, calls.verify.length);
      return route.fulfill({ json: session });
    }
    if (url.pathname.endsWith('/auth/me')) {
      calls.me.push(record);
      if (options.me) return options.me(route);
      return route.fulfill({ json: user });
    }
    if (url.pathname.endsWith('/auth/refresh')) {
      calls.refresh.push(record);
      if (options.refresh) return options.refresh(route);
    }
    if (url.pathname.endsWith('/test/private')) {
      calls.protected.push(record);
      if (options.protected) return options.protected(route, calls.protected.length);
      return route.fulfill({ status: 401, json: { code: 'TOKEN_EXPIRED' } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/#/login');
  await expect(page.locator('.phone-input')).toBeVisible();
  return { calls, errors };
}

async function requestCode(page, number = phone) {
  await page.locator('.phone-input').fill(number);
  await page.locator('.login-button').click();
  await expect(page.locator('.code-input')).toHaveCount(4);
}

async function enterCode(page, code = '1234') {
  for (const [index, digit] of [...code].entries()) await page.locator('.code-input').nth(index).fill(digit);
}

test('server OTP length controls existing slots and a new local session uses its own profile token', async ({ page }) => {
  const gate = deferred();
  const { calls, errors } = await setup(page, {
    verify: async (route) => { await gate.promise; await route.fulfill({ json: session }); }
  });
  await requestCode(page, '۰۹۱۲۱۲۳۴۵۶۷');
  expect(calls.request[0]).toEqual({ body: { phone }, authorization: undefined });
  await enterCode(page, '۱۲۳۴');
  await expect.poll(() => calls.verify.length).toBe(1);
  await expect(page.locator('.code-input').first()).toHaveAttribute('readonly', '');
  expect(calls.verify[0].body).toEqual({ phone, otp: '1234' });
  gate.resolve();
  await expect(page).toHaveURL(/#\/pinfo$/);
  expect(calls.verify).toHaveLength(1);
  expect(calls.me[0].authorization).toBe('Bearer local-access');
  expect(await page.evaluate(() => sessionStorage.getItem('gp_user_access_token'))).toBe('local-access');
  expect(await page.evaluate(() => localStorage.getItem('gp_user_refresh_token'))).toBe('local-refresh');
  expect(calls.external).toEqual([]);
  expect(errors).toEqual([]);
});

test('rejected code can be corrected without refreshing or clearing an existing saved session', async ({ page }) => {
  const oldSession = { accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 7 } };
  const { calls } = await setup(page, {
    oldSession,
    verify: (route, count) => count === 1
      ? route.fulfill({ status: 401, json: { code: 'INVALID_OTP' } })
      : route.fulfill({ json: session })
  });
  await requestCode(page);
  await enterCode(page);
  await expect(page.locator('.verification-container .error-message')).toBeVisible();
  expect(calls.verify).toHaveLength(1);
  expect(calls.refresh).toHaveLength(0);
  expect(calls.verify[0].authorization).toBeUndefined();
  expect(await page.evaluate(() => sessionStorage.getItem('gp_user_access_token'))).toBe('old-access');
  await page.locator('.code-input').last().fill('5');
  await expect(page).toHaveURL(/#\/pinfo$/);
  expect(calls.verify).toHaveLength(2);
  expect(calls.verify[1].body.otp).toBe('1235');
});

test('resending clears an old code and restarts the server cooldown on every successful resend', async ({ page }) => {
  await page.clock.install();
  const { calls } = await setup(page);
  await requestCode(page);
  await page.locator('.code-input').first().fill('9');
  await page.clock.runFor(2100);
  await page.locator('.resend-button').click();
  await expect.poll(() => calls.request.length).toBe(2);
  await expect(page.locator('.code-input').first()).toHaveValue('');
  await expect(page.locator('.resend-button')).toHaveCount(0);
  await page.clock.runFor(2100);
  await expect(page.locator('.resend-button')).toBeVisible();
  await page.locator('.resend-button').click();
  await expect.poll(() => calls.request.length).toBe(3);
  expect(calls.verify).toHaveLength(0);
});

test('double phone submission sends one OTP request and supports legacy six-digit metadata fallback', async ({ page }) => {
  const gate = deferred();
  const { calls } = await setup(page, {
    request: async (route) => { await gate.promise; await route.fulfill({ json: {} }); }
  });
  await page.locator('.phone-input').fill(phone);
  await page.locator('.login-form').evaluate((form) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect.poll(() => calls.request.length).toBe(1);
  await expect(page.locator('.login-button')).toBeDisabled();
  gate.resolve();
  await expect(page.locator('.code-input')).toHaveCount(6);
  expect(calls.request).toHaveLength(1);
});

test('editing the phone discards an in-flight verification result', async ({ page }) => {
  const gate = deferred();
  const { calls } = await setup(page, {
    verify: async (route) => { await gate.promise; await route.fulfill({ json: session }); }
  });
  await requestCode(page);
  await enterCode(page);
  await expect.poll(() => calls.verify.length).toBe(1);
  await page.locator('.edit-button').click();
  await expect(page.locator('.phone-input')).toBeVisible();
  gate.resolve();
  await requestCode(page, '09129876543');
  expect(calls.request.at(-1).body.phone).toBe('09129876543');
  expect(calls.me).toHaveLength(0);
  expect(await page.evaluate(() => sessionStorage.getItem('gp_user_access_token'))).toBeNull();
  await expect(page.locator('.code-input').first()).toHaveValue('');
  await expect(page).toHaveURL(/#\/login$/);
});

test('leaving login discards a pending OTP request instead of reopening verification later', async ({ page }) => {
  const gate = deferred();
  const { calls } = await setup(page, {
    request: async (route) => { await gate.promise; await route.fulfill({ json: { otpLength: 4 } }); }
  });
  await page.locator('.phone-input').fill(phone);
  await page.locator('.login-button').click();
  await expect.poll(() => calls.request.length).toBe(1);
  await page.evaluate(() => { window.location.hash = '/rules'; });
  await expect(page.locator('.login-page')).toHaveCount(0);
  gate.resolve();
  await page.evaluate(() => { window.location.hash = '/login'; });
  await expect(page.locator('.phone-input')).toBeVisible();
  await expect(page.locator('.code-input')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('gp_user_access_token'))).toBeNull();
});

test('failed profile lookup never commits a partial new session or retries it with another user token', async ({ page }) => {
  const { calls } = await setup(page, {
    oldSession: { accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 7 } },
    me: (route) => route.fulfill({ status: 401, json: { code: 'INVALID_TOKEN' } })
  });
  await requestCode(page);
  await enterCode(page);
  await expect(page.locator('.verification-container .error-message')).toBeVisible();
  expect(calls.me).toHaveLength(1);
  expect(calls.refresh).toHaveLength(0);
  expect(await page.evaluate(() => sessionStorage.getItem('gp_user_access_token'))).toBe('old-access');
  await expect(page).toHaveURL(/#\/login$/);
});

for (const outcome of ['success', 'failure']) {
  test(`an old account refresh ${outcome} cannot replace or clear a completed new OTP login`, async ({ page }) => {
    const gate = deferred();
    const { calls } = await setup(page, {
      oldSession: { accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 7 } },
      refresh: async (route) => {
        await gate.promise;
        return outcome === 'success'
          ? route.fulfill({ json: { accessToken: 'old-rotated-access', refreshToken: 'old-rotated-refresh', user: { id: 7 } } })
          : route.fulfill({ status: 401, json: { code: 'INVALID_TOKEN' } });
      }
    });
    await page.evaluate(async () => {
      const { default: api } = await import('/src/api/apiUser.js');
      window.oldAccountRequest = api.get('/api/v1/test/private').then(() => 'completed', () => 'rejected');
    });
    await expect.poll(() => calls.refresh.length).toBe(1);
    await requestCode(page);
    await enterCode(page);
    await expect(page).toHaveURL(/#\/pinfo$/);
    gate.resolve();
    expect(await page.evaluate(() => window.oldAccountRequest)).toBe('rejected');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gp_user_auth_store')).state);
    expect(stored.accessToken).toBe('local-access');
    expect(stored.refreshToken).toBe('local-refresh');
    expect(stored.user.id).toBe(41);
    expect(await page.evaluate(() => sessionStorage.getItem('gp_user_access_token'))).toBe('local-access');
    expect(await page.evaluate(() => localStorage.getItem('gp_user_refresh_token'))).toBe('local-refresh');
    expect(calls.protected).toHaveLength(1);
    expect(calls.protected[0].authorization).toBe('Bearer old-access');
  });
}

test('concurrent requests still share one refresh and retry with their own rotated account token', async ({ page }) => {
  const gate = deferred();
  const { calls } = await setup(page, {
    oldSession: { accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 7 } },
    protected: (route, count) => count <= 2
      ? route.fulfill({ status: 401, json: { code: 'TOKEN_EXPIRED' } })
      : route.fulfill({ json: { ok: true } }),
    refresh: async (route) => {
      await gate.promise;
      return route.fulfill({ json: { accessToken: 'rotated-access', refreshToken: 'rotated-refresh', user: { id: 7 } } });
    }
  });
  await page.evaluate(async () => {
    const { default: api } = await import('/src/api/apiUser.js');
    window.accountRequests = Promise.all([
      api.get('/api/v1/test/private'), api.get('/api/v1/test/private')
    ]).then((results) => results.map((result) => result.data.ok));
  });
  await expect.poll(() => calls.protected.length).toBe(2);
  await expect.poll(() => calls.refresh.length).toBe(1);
  gate.resolve();
  expect(await page.evaluate(() => window.accountRequests)).toEqual([true, true]);
  expect(calls.protected.map((call) => call.authorization)).toEqual([
    'Bearer old-access', 'Bearer old-access', 'Bearer rotated-access', 'Bearer rotated-access'
  ]);
});

test('a delayed old-token 401 retries the rotated token after the same-session refresh has settled', async ({ page }) => {
  const delayedUnauthorized = deferred();
  const { calls } = await setup(page, {
    oldSession: { accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 7 } },
    protected: async (route, count) => {
      if (count === 2) await delayedUnauthorized.promise;
      return count <= 2
        ? route.fulfill({ status: 401, json: { code: 'TOKEN_EXPIRED' } })
        : route.fulfill({ json: { ok: true } });
    },
    refresh: (route) => route.fulfill({
      json: { accessToken: 'rotated-access', refreshToken: 'rotated-refresh', user: { id: 7 } }
    })
  });
  await page.evaluate(async () => {
    const { default: api } = await import('/src/api/apiUser.js');
    window.firstAccountRequest = api.get('/api/v1/test/private').then((result) => result.data.ok);
    window.delayedAccountRequest = api.get('/api/v1/test/private').then((result) => result.data.ok);
  });
  expect(await page.evaluate(() => window.firstAccountRequest)).toBe(true);
  expect(calls.refresh).toHaveLength(1);
  expect(calls.protected).toHaveLength(3);
  delayedUnauthorized.resolve();
  expect(await page.evaluate(() => window.delayedAccountRequest)).toBe(true);
  expect(calls.refresh).toHaveLength(1);
  expect(calls.protected.map((call) => call.authorization)).toEqual([
    'Bearer old-access', 'Bearer old-access', 'Bearer rotated-access', 'Bearer rotated-access'
  ]);
});

test('an old profile lookup cannot overwrite the account authenticated by OTP', async ({ page }) => {
  const gate = deferred();
  const { calls } = await setup(page, {
    oldSession: { accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 7 } },
    me: async (route) => {
      if (route.request().headers().authorization === 'Bearer old-access') {
        await gate.promise;
        return route.fulfill({ json: { id: 7, profileCompleted: true } });
      }
      return route.fulfill({ json: user });
    }
  });
  await page.evaluate(async () => {
    const { useUserAuthStore } = await import('/src/auth/user/userAuthStore.js');
    window.oldAccountProfile = useUserAuthStore.getState().fetchMe().then(() => 'completed', () => 'rejected');
  });
  await expect.poll(() => calls.me.length).toBe(1);
  await requestCode(page);
  await enterCode(page);
  await expect(page).toHaveURL(/#\/pinfo$/);
  gate.resolve();
  expect(await page.evaluate(() => window.oldAccountProfile)).toBe('rejected');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gp_user_auth_store')).state);
  expect(stored.accessToken).toBe('local-access');
  expect(stored.user.id).toBe(41);
});
