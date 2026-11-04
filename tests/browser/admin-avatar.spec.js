import { test, expect } from '@playwright/test';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=', 'base64');
const file = { name: 'avatar.png', mimeType: 'image/png', buffer: png };
const avatar = (id, version) => `/api/v1/files?path=uploads%2Fadmin_avatars%2F${id}%2F${version}.png&inline=1`;
const absolute = (url) => `http://localhost:8080${url}`;
const modal = (page) => page.locator('.avatar-upload-modal');
const headerImage = (page) => page.locator('#amain-profile-menu .admin-avatar-img');
const pause = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };

async function setup(page) {
  const state = {
    avatars: new Map([[101, avatar(101, 'old')], [202, avatar(202, 'second')]]),
    uploads: [], deletes: [], dialogs: [], uploadStatus: 200, deleteStatus: 200,
    uploadGate: null, profileGate: null, heldProfiles: 0, expireUpload: false, refreshes: 0,
  };
  page.on('dialog', async dialog => { state.dialogs.push(dialog.message()); await dialog.accept(); });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('gp_admin_access_token')) {
      sessionStorage.setItem('gp_admin_access_token', 'fixture-101');
      localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: { refreshToken: 'fixture-refresh' }, version: 0 }));
    }
  });
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (url.hostname === '127.0.0.1' && ['5173', '5179'].includes(url.port)) return route.continue();
    if (url.hostname !== 'localhost' || url.port !== '8080') return route.abort();
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const token = request.headers().authorization || '';
    const id = token.includes('202') ? 202 : 101;
    if (path.endsWith('/admin/auth/me')) {
      const json = { id, name: `Fixture ${id}`, roles: ['super_dashboard_admin'], roleTitles: [], permissions: [], avatarUrl: state.avatars.get(id) };
      const gate = state.profileGate; state.profileGate = null;
      if (gate) { state.heldProfiles++; await gate; }
      return route.fulfill({ json, headers });
    }
    if (path.endsWith('/admin/auth/refresh')) {
      state.refreshes++;
      return route.fulfill({ json: { accessToken: 'fixture-refreshed-101', refreshToken: 'refreshed', expiresIn: 1800 }, headers });
    }
    if (path.endsWith('/admin/auth/avatar') && request.method() === 'POST') {
      state.uploads.push({ id, headers: request.headers(), body: request.postDataBuffer() });
      if (state.expireUpload) { state.expireUpload = false; return route.fulfill({ status: 401, json: { error: 'TOKEN_INVALID' }, headers }); }
      const gate = state.uploadGate; state.uploadGate = null;
      if (gate) await gate;
      if (state.uploadStatus !== 200) return route.fulfill({ status: state.uploadStatus, json: { message: 'fixture upload failed' }, headers });
      const value = avatar(id, `new-${state.uploads.length}`); state.avatars.set(id, value);
      return route.fulfill({ json: { url: value }, headers });
    }
    if (path.endsWith('/admin/auth/avatar') && request.method() === 'DELETE') {
      state.deletes.push(id);
      if (state.deleteStatus !== 200) return route.fulfill({ status: state.deleteStatus, json: { message: 'fixture delete failed' }, headers });
      state.avatars.set(id, null);
      return route.fulfill({ json: { message: 'AVATAR_DELETED', url: null }, headers });
    }
    if (path === '/api/v1/files') return route.fulfill({ body: png, contentType: 'image/png', headers });
    if (path.includes('/style') && path.endsWith('.json')) return route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] }, headers });
    if (path.startsWith('/tiles/') || path.startsWith('/tms/')) return route.fulfill({ status: 204, headers });
    if (path.endsWith('/floors')) return route.fulfill({ json: [{ floor: 0, label: 'همکف' }], headers });
    return route.fulfill({ json: { data: [], items: [], total: 0 }, headers });
  });
  await page.goto('/#/admin');
  await expect(headerImage(page)).toHaveAttribute('src', absolute(state.avatars.get(101)));
  return state;
}

async function selectImage(page) {
  await page.locator('#amain-profile-menu').click();
  await page.locator('#avatar-upload').setInputFiles(file);
  await expect(modal(page).locator('.avatar-preview-img')).toHaveAttribute('src', /^data:image\/png/);
}

test('admin avatar uploads multipart, survives reload, and deletion persists', async ({ page }) => {
  const state = await setup(page);
  await selectImage(page);
  await modal(page).getByRole('button', { name: 'ذخیره تصویر', exact: true }).click();
  await expect(modal(page)).toHaveCount(0);
  expect(state.uploads).toHaveLength(1);
  expect(state.uploads[0].headers.authorization).toBe('Bearer fixture-101');
  expect(state.uploads[0].headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  expect(state.uploads[0].body.toString()).toContain('filename="avatar.png"');
  await expect(headerImage(page)).toHaveAttribute('src', absolute(state.avatars.get(101)));
  await expect.poll(() => headerImage(page).evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.reload();
  await expect(headerImage(page)).toHaveAttribute('src', absolute(state.avatars.get(101)));
  await page.locator('#amain-profile-menu').click();
  await modal(page).getByRole('button', { name: 'حذف تصویر', exact: true }).click();
  await expect(modal(page)).toHaveCount(0);
  await expect(headerImage(page)).toHaveCount(0);
  expect(state.deletes).toEqual([101]);
  await page.reload();
  await expect(page.locator('#amain-profile-menu .default-avatar')).toBeVisible();
});

test('failures preserve the saved image and duplicate saves send only one request', async ({ page }) => {
  const state = await setup(page);
  state.uploadStatus = 500;
  await selectImage(page);
  await modal(page).getByRole('button', { name: 'ذخیره تصویر', exact: true }).click();
  await expect.poll(() => state.dialogs).toContain('fixture upload failed');
  await expect(modal(page)).toBeVisible();
  await expect(headerImage(page)).toHaveAttribute('src', absolute(avatar(101, 'old')));
  expect(state.dialogs).not.toContain('تصویر پروفایل با موفقیت آپلود شد');
  state.uploadStatus = 200;
  const gate = pause(); state.uploadGate = gate.promise;
  await modal(page).getByRole('button', { name: 'ذخیره تصویر', exact: true }).click();
  await expect.poll(() => state.uploads.length).toBe(2);
  await expect(modal(page).locator('.confirm-btn')).toBeDisabled();
  await modal(page).locator('.confirm-btn').evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(state.uploads).toHaveLength(2);
  gate.release();
  await expect(modal(page)).toHaveCount(0);
  const saved = state.avatars.get(101);
  state.deleteStatus = 500;
  await page.locator('#amain-profile-menu').click();
  await modal(page).getByRole('button', { name: 'حذف تصویر', exact: true }).click();
  await expect.poll(() => state.dialogs).toContain('fixture delete failed');
  await expect(headerImage(page)).toHaveAttribute('src', absolute(saved));
  await expect(modal(page)).toBeVisible();
  expect(state.dialogs).not.toContain('تصویر پروفایل حذف شد');
});

test('late uploads cannot replace the next administrators profile', async ({ page }) => {
  const state = await setup(page);
  const gate = pause(); state.uploadGate = gate.promise;
  await selectImage(page);
  await modal(page).getByRole('button', { name: 'ذخیره تصویر', exact: true }).click();
  await expect.poll(() => state.uploads.length).toBe(1);
  await page.evaluate(async value => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    useAdminAuthStore.getState().setAuth({ accessToken: 'fixture-202', refreshToken: 'second-refresh',
      user: { id: 202, name: 'Second', roles: ['super_dashboard_admin'], avatarUrl: value } });
  }, avatar(202, 'second'));
  await expect(headerImage(page)).toHaveAttribute('src', absolute(avatar(202, 'second')));
  const response = page.waitForResponse(res => res.url().endsWith('/admin/auth/avatar'));
  gate.release(); await response;
  await expect.poll(() => page.evaluate(async () => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    return useAdminAuthStore.getState().admin;
  })).toMatchObject({ id: 202, avatarUrl: avatar(202, 'second') });
  await expect(headerImage(page)).toHaveAttribute('src', absolute(avatar(202, 'second')));
  expect(state.dialogs).not.toContain('تصویر پروفایل با موفقیت آپلود شد');
});

test('access token refresh preserves the upload within the same account', async ({ page }) => {
  const state = await setup(page); state.expireUpload = true;
  await selectImage(page);
  await modal(page).getByRole('button', { name: 'ذخیره تصویر', exact: true }).click();
  await expect(modal(page)).toHaveCount(0);
  expect(state.refreshes).toBe(1);
  expect(state.uploads).toHaveLength(2);
  expect(state.uploads[1].headers.authorization).toBe('Bearer fixture-refreshed-101');
  await expect(headerImage(page)).toHaveAttribute('src', absolute(state.avatars.get(101)));
});

test('stale unauthorized uploads cannot refresh or log out the replacement account', async ({ page }) => {
  const state = await setup(page); state.uploadStatus = 401;
  const gate = pause(); state.uploadGate = gate.promise;
  await selectImage(page);
  await modal(page).getByRole('button', { name: 'ذخیره تصویر', exact: true }).click();
  await expect.poll(() => state.uploads.length).toBe(1);
  await page.evaluate(async value => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    useAdminAuthStore.getState().setAuth({ accessToken: 'fixture-202', refreshToken: 'second-refresh',
      user: { id: 202, roles: ['super_dashboard_admin'], avatarUrl: value } });
  }, avatar(202, 'second'));
  const response = page.waitForResponse(res => res.url().endsWith('/admin/auth/avatar'));
  gate.release(); await response;
  await expect(headerImage(page)).toHaveAttribute('src', absolute(avatar(202, 'second')));
  expect(state.refreshes).toBe(0);
  expect(state.uploads).toHaveLength(1);
  await expect(page).toHaveURL(/#\/admin$/);
});

test('a slow profile response cannot undo a completed avatar upload', async ({ page }) => {
  const state = await setup(page);
  const gate = pause(); state.profileGate = gate.promise;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => state.heldProfiles).toBe(1);
  await selectImage(page);
  await modal(page).getByRole('button', { name: 'ذخیره تصویر', exact: true }).click();
  await expect(modal(page)).toHaveCount(0);
  const saved = state.avatars.get(101);
  const response = page.waitForResponse(res => res.url().endsWith('/admin/auth/me'));
  gate.release(); await response;
  await expect(headerImage(page)).toHaveAttribute('src', absolute(saved));
});
