import { test, expect } from '@playwright/test';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=', 'base64');
const file = { name: 'avatar.png', mimeType: 'image/png', buffer: png };

test('avatar upload works on incomplete profile, survives reload, and failure preserves it', async ({ page }) => {
  let avatar = '/storage/avatars/old.png';
  let uploads = 0;
  await page.addInitScript(() => {
    if (!localStorage.getItem('gp_user_auth_store')) {
      const user = { id: 41, phone: '09121234567', profileCompleted: false };
      localStorage.setItem('gp_user_auth_store', JSON.stringify({ state: { accessToken: 'token', refreshToken: 'refresh', user }, version: 0 }));
      localStorage.setItem('gp_user_refresh_token', 'refresh');
      sessionStorage.setItem('gp_user_access_token', 'token');
    }
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === '5173') return route.continue();
    if (url.hostname !== 'localhost' || url.port !== '8080') return route.abort();
    if (url.pathname === '/api/v1/users/me') return route.fulfill({ json: { id: 41, profileCompleted: false, avatarUrl: avatar } });
    if (url.pathname === '/api/v1/files/avatar') {
      uploads++;
      if (uploads === 2) return route.fulfill({ status: 422, json: { message: 'Upload failed' } });
      avatar = '/storage/avatars/new.png';
      return route.fulfill({ json: { url: avatar } });
    }
    if (url.pathname.startsWith('/storage/avatars/')) return route.fulfill({ contentType: 'image/png', body: png });
    return route.fulfill({ json: {} });
  });
  await page.goto('/#/pinfo');
  const input = page.locator('input[type=file]');
  const image = page.locator('.avatar-container img');
  await expect(image).toHaveAttribute('src', 'http://localhost:8080/storage/avatars/old.png');
  await input.setInputFiles(file);
  await expect(image).toHaveAttribute('src', 'http://localhost:8080/storage/avatars/new.png');
  await input.setInputFiles(file);
  await expect.poll(() => uploads).toBe(2);
  await expect(image).toHaveAttribute('src', 'http://localhost:8080/storage/avatars/new.png');
  await page.reload();
  await expect(image).toHaveAttribute('src', 'http://localhost:8080/storage/avatars/new.png');
  await page.goto('/#/profile');
  const profileImage = page.locator('.profile-avatar img');
  await expect(profileImage).toHaveAttribute('src', 'http://localhost:8080/storage/avatars/new.png');
  await expect.poll(() => profileImage.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.locator('.profile-avatar input[type=file]').setInputFiles(file);
  await expect.poll(() => uploads).toBe(3);
});

test('late upload cannot replace another account and broken images show the fallback', async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let started;
  const uploading = new Promise((resolve) => { started = resolve; });
  await page.addInitScript(() => {
    localStorage.setItem('gp_user_auth_store', JSON.stringify({ state: { accessToken: 'first', refreshToken: 'first-refresh', user: { id: 1 } }, version: 0 }));
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === '5173') return route.continue();
    if (url.hostname !== 'localhost' || url.port !== '8080') return route.abort();
    if (url.pathname === '/api/v1/users/me') return route.fulfill({ json: { id: 1, avatarUrl: '/storage/avatars/missing.png' } });
    if (url.pathname === '/api/v1/files/avatar') { started(); await pending; return route.fulfill({ json: { url: '/storage/avatars/first.png' } }); }
    if (url.pathname.startsWith('/storage/avatars/')) return route.fulfill({ status: 404 });
    return route.fulfill({ json: {} });
  });
  await page.goto('/#/profile');
  await expect(page.locator('.profile-avatar svg')).toBeVisible();
  await page.locator('.profile-avatar input[type=file]').setInputFiles(file);
  await uploading;
  await page.evaluate(async () => {
    const { useUserAuthStore } = await import('/src/auth/user/userAuthStore.js');
    useUserAuthStore.getState().setSession({ accessToken: 'second', refreshToken: 'second-refresh', user: { id: 2, avatarUrl: '/storage/avatars/second.png' } });
  });
  const response = page.waitForResponse((res) => res.url().endsWith('/api/v1/files/avatar'));
  release();
  await response;
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('gp_user_auth_store')).state.user.id)).toBe(2);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('gp_user_auth_store')).state.user.avatarUrl)).toBe('/storage/avatars/second.png');
});
