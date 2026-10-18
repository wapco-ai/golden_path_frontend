import { test, expect } from '@playwright/test';

const now = '2026-10-18T12:00:00Z';
const event = (type, id, createdAt = now) => ({ id: `${type}:${id}`, entityId: id, type, createdAt, title: 'اعلان آزمایشی', message: `پیام ${id}`, read: false });
const standardEvents = () => [
  event('new_user', 1), event('new_comment', 1, '2026-10-18T11:00:00Z'),
  event('new_comment', 2, '2026-10-18T11:30:00Z'), event('support_message', 1, '2026-10-17T10:00:00Z'),
  event('new_user', 2, '2026-10-10T10:00:00Z'), event('support_message', 2, '2026-10-09T10:00:00Z')
];

async function setup(page, { events = standardEvents() } = {}) {
  const requests = [], writes = [], errors = [], receipts = new Map();
  const readsFor = admin => {
    if (!receipts.has(admin)) receipts.set(admin, new Set());
    return receipts.get(admin);
  };
  const state = { events, writeStatus: 200, getFailures: 0, nextGetGate: null, nextWriteGate: null, nextResponseGate: null, heldGets: 0, finishedHeldGets: 0 };
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('gp_admin_access_token')) {
      sessionStorage.setItem('gp_admin_access_token', 'fixture-admin-101');
      localStorage.setItem('gp_admin_auth_store', JSON.stringify({ state: { admin: { id: 101, name: 'مدیر اول' }, roles: ['admin'], permissions: ['*'] }, version: 0 }));
    }
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language: 'fa' }, version: 1 }));
  });
  await page.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const admin = request.headers().authorization === 'Bearer fixture-admin-202' ? 202 : 101;
    let json = { data: [], total: 0 }, status = 200;
    if (path.endsWith('/admin/auth/me')) json = { user: { id: admin, name: admin === 101 ? 'مدیر اول' : 'مدیر دوم', roles: ['admin'], permissions: ['*'] } };
    else if (path.endsWith('/floors')) json = [{ floor: 0, label: 'همکف' }];
    else if (path.endsWith('/groups/metadata')) json = { groups: [] };
    else if (path.endsWith('/groups/subgroups')) json = { subGroups: {} };
    else if (path.endsWith('/dashboard/notifications') && request.method() === 'GET') {
      const params = Object.fromEntries(url.searchParams); requests.push({ params, admin });
      const all = state.events.map(item => ({ ...item, read: readsFor(admin).has(item.id) }));
      const unread = all.filter(item => !item.read);
      const selected = (params.unreadOnly === 'true' ? unread : all).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id)).slice(0, Number(params.limit) || 10);
      json = params.includeMeta === 'true' ? { items: selected, unreadCount: unread.length } : selected;
      if (state.getFailures) { state.getFailures -= 1; status = 500; json = { message: 'خطای دریافت اعلان‌ها' }; }
      const gate = state.nextGetGate; state.nextGetGate = null;
      if (gate) { state.heldGets += 1; await gate; }
      await route.fulfill({ status, json });
      if (gate) state.finishedHeldGets += 1;
      return;
    } else if (/\/dashboard\/notifications\/(read|read-all)$/.test(path) && request.method() === 'POST') {
      const all = path.endsWith('/read-all'), body = request.postData() ? request.postDataJSON() : null;
      writes.push({ all, body, admin, headers: request.headers(), method: request.method() });
      const gate = state.nextWriteGate; state.nextWriteGate = null;
      if (gate) await gate;
      status = state.writeStatus;
      if (status === 200) {
        const ids = all ? state.events.map(item => item.id) : body.ids;
        for (const id of ids) if (state.events.some(item => item.id === id)) readsFor(admin).add(id);
        json = { success: true, unreadCount: state.events.filter(item => !readsFor(admin).has(item.id)).length };
      } else json = { message: 'ثبت خواندن اعلان‌ها ناموفق بود' };
      const responseGate = state.nextResponseGate; state.nextResponseGate = null;
      if (responseGate) await responseGate;
    }
    await route.fulfill({ status, json });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'background', type: 'background' }] } }));
  await page.route('**/tiles/**', route => route.fulfill({ status: 204 }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.goto('/#/admin');
  await expect(page.locator('.notification-badge')).toHaveText(events.length > 99 ? '99+' : String(events.length));
  return { state, requests, writes, errors, readsFor };
}

const popup = page => page.locator('.notifications-popup');
const cards = page => popup(page).locator('.notification-item');
const comments = page => cards(page).filter({ has: page.getByRole('heading', { name: 'دیدگاه جدید', exact: true }) });
const markAll = page => popup(page).getByRole('button', { name: 'خواندن همه', exact: true });
const badge = page => page.locator('.notification-badge');
async function open(page) { await page.locator('.notifications-btn').click(); await expect(popup(page)).toBeVisible(); }
async function changeAdmin(page, id = 202) {
  await page.evaluate(async id => {
    const { useAdminAuthStore } = await import('/src/auth/admin/adminAuthStore.js');
    useAdminAuthStore.getState().setAuth({ accessToken: `fixture-admin-${id}`, user: { id, name: 'مدیر دوم', roles: ['admin'], permissions: ['*'] } });
  }, id);
}

test('notification popup retains its layout and includes the exact current-time event', async ({ page }, testInfo) => {
  const { requests, errors } = await setup(page);
  await open(page); await expect(cards(page)).toHaveCount(5);
  await expect(markAll(page)).toBeVisible();
  expect(requests.at(-1).params).toMatchObject({ limit: '10', unreadOnly: 'true', includeMeta: 'true' });
  await popup(page).screenshot({ path: testInfo.outputPath('notifications-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await popup(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  await popup(page).screenshot({ path: testInfo.outputPath('notifications-mobile.png') });
  expect(errors).toEqual([]);
});

test('global badge exceeds the fetched page and read-all works for old notifications beyond that page', async ({ page }) => {
  const events = Array.from({ length: 25 }, (_, index) => event('new_user', index + 1, `2026-10-10T10:${String(index).padStart(2, '0')}:00Z`));
  const { writes, errors, readsFor } = await setup(page, { events });
  await open(page); await expect(badge(page)).toHaveText('25');
  await expect(cards(page)).toHaveCount(1); await expect(cards(page)).toContainText('10');
  await markAll(page).click();
  await expect(page.getByText('هیچ اعلانی وجود ندارد', { exact: true })).toBeVisible();
  await expect(badge(page)).toHaveCount(0);
  expect(readsFor(101).size).toBe(25); expect(writes[0].all).toBe(true); expect(errors).toEqual([]);
});

test('large global unread counts stay inside the existing badge on desktop and mobile', async ({ page }) => {
  const events = Array.from({ length: 250 }, (_, index) => event('new_user', index + 1));
  const { errors } = await setup(page, { events });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(badge(page)).toHaveText('99+');
    await expect(badge(page)).toHaveAccessibleName('250 اعلان خوانده‌نشده');
    await expect(badge(page)).toHaveAttribute('title', '250 اعلان خوانده‌نشده');
    const dimensions = await badge(page).evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const text = range.getBoundingClientRect(), box = node.getBoundingClientRect();
      return { width: box.width, height: box.height, textLeft: text.left, textRight: text.right, left: box.left, right: box.right };
    });
    expect(dimensions.width).toBe(18); expect(dimensions.height).toBe(18);
    expect(dimensions.textLeft).toBeGreaterThanOrEqual(dimensions.left);
    expect(dimensions.textRight).toBeLessThanOrEqual(dimensions.right);
  }
  await open(page); await expect(markAll(page)).toBeVisible(); expect(errors).toEqual([]);
});

test('clicking a group acknowledges exactly its members and persists through reload', async ({ page }) => {
  const { writes, errors, readsFor } = await setup(page);
  await open(page); await comments(page).click();
  await expect(comments(page)).toHaveCount(0); await expect(badge(page)).toHaveText('4');
  expect(writes[0].body.ids.sort()).toEqual(['new_comment:1', 'new_comment:2']);
  expect(writes[0].headers.authorization).toBe('Bearer fixture-admin-101');
  expect(writes[0].headers.accept).toContain('application/json');
  expect(readsFor(101).size).toBe(2);
  await page.reload(); await expect(badge(page)).toHaveText('4');
  await open(page); await expect(comments(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a rejected acknowledgement retains its cards and counter and can be retried', async ({ page }) => {
  const { state, writes, errors } = await setup(page);
  state.writeStatus = 500;
  await open(page); await comments(page).click();
  await expect(page.locator('.Toastify__toast--error')).toBeVisible();
  await expect(comments(page)).toHaveCount(1); await expect(badge(page)).toHaveText('6');
  state.writeStatus = 200;
  await comments(page).click();
  await expect(comments(page)).toHaveCount(0); await expect(badge(page)).toHaveText('4');
  expect(writes).toHaveLength(2); expect(errors).toEqual([]);
});

test('pending acknowledgement sends one write and does not optimistically remove unread cards', async ({ page }) => {
  const { state, writes, errors } = await setup(page);
  let release; state.nextWriteGate = new Promise(resolve => { release = resolve; });
  try {
    await open(page); await comments(page).click();
    await expect.poll(() => writes.length).toBe(1);
    await expect(markAll(page)).toBeDisabled(); await expect(badge(page)).toHaveText('6');
    await comments(page).click();
    expect(writes).toHaveLength(1); await expect(comments(page)).toHaveCount(1);
    release();
    await expect(comments(page)).toHaveCount(0); await expect(badge(page)).toHaveText('4');
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('every popup opening refreshes new events and updates the badge', async ({ page }) => {
  const { state, requests, errors } = await setup(page);
  await open(page); await expect(cards(page)).toHaveCount(5);
  await page.locator('.notifications-btn').click();
  const before = requests.length;
  state.events.push(event('new_user', 99));
  await open(page); await expect.poll(() => requests.length).toBeGreaterThan(before);
  await expect(badge(page)).toHaveText('7');
  expect(errors).toEqual([]);
});

test('a GET captured before reading a group cannot restore its unread cards or counter', async ({ page }) => {
  const { state, writes, errors } = await setup(page);
  await open(page); await expect(cards(page)).toHaveCount(5);
  await page.locator('.notifications-btn').click();
  let release; state.nextGetGate = new Promise(resolve => { release = resolve; });
  try {
    await open(page); await expect.poll(() => state.heldGets).toBe(1);
    await comments(page).click(); await expect.poll(() => writes.length).toBe(1);
    await expect(badge(page)).toHaveText('4'); await expect(comments(page)).toHaveCount(0);
    release(); await expect.poll(() => state.finishedHeldGets).toBe(1);
    await page.waitForTimeout(150);
    await expect(badge(page)).toHaveText('4'); await expect(comments(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('a failed popup refresh retains known unread items and retry shows new data', async ({ page }) => {
  const { state, errors } = await setup(page);
  state.events.push(event('new_user', 99)); state.getFailures = 1;
  await open(page);
  await expect(page.locator('.Toastify__toast--error')).toBeVisible();
  await expect(badge(page)).toHaveText('6'); await expect(comments(page)).toHaveCount(1);
  await page.locator('.Toastify__close-button').click();
  await expect(page.locator('.Toastify__toast--error')).toHaveCount(0);
  await expect(popup(page)).toHaveCount(0); await open(page);
  await expect(badge(page)).toHaveText('7'); expect(errors).toEqual([]);
});

test('an old admin GET cannot overwrite the next admin notification state', async ({ page }) => {
  const { state, readsFor, errors } = await setup(page);
  readsFor(202).add('new_user:1');
  await open(page); await expect(cards(page)).toHaveCount(5);
  await page.locator('.notifications-btn').click();
  let release; state.nextGetGate = new Promise(resolve => { release = resolve; });
  try {
    await open(page); await expect.poll(() => state.heldGets).toBe(1);
    await changeAdmin(page); await expect(badge(page)).toHaveText('5');
    await open(page); await comments(page).click(); await expect(badge(page)).toHaveText('3');
    release(); await expect.poll(() => state.finishedHeldGets).toBe(1);
    await page.waitForTimeout(150); await expect(badge(page)).toHaveText('3');
    expect(readsFor(101).size).toBe(0); expect(readsFor(202).size).toBe(3); expect(errors).toEqual([]);
  } finally { release(); }
});

test('an old admin POST response cannot mark cards read in the next admin session', async ({ page }) => {
  const { state, writes, readsFor, errors } = await setup(page);
  let release; state.nextResponseGate = new Promise(resolve => { release = resolve; });
  try {
    await open(page); await comments(page).click(); await expect.poll(() => writes.length).toBe(1);
    await changeAdmin(page); await expect(badge(page)).toHaveText('6');
    await open(page); await expect(comments(page)).toHaveCount(1);
    release(); await page.waitForTimeout(150);
    await expect(badge(page)).toHaveText('6'); await expect(comments(page)).toHaveCount(1);
    expect(readsFor(101).size).toBe(2); expect(readsFor(202).size).toBe(0); expect(errors).toEqual([]);
  } finally { release(); }
});

test('opening during read-all queues a refresh and preserves events created after its server snapshot', async ({ page }) => {
  const { state, requests, writes, errors } = await setup(page);
  let release; state.nextResponseGate = new Promise(resolve => { release = resolve; });
  try {
    await open(page); await expect(cards(page)).toHaveCount(5);
    await markAll(page).click(); await expect.poll(() => writes.length).toBe(1);
    state.events.push(event('new_comment', 99));
    await page.locator('.notifications-btn').click();
    const before = requests.length;
    await open(page); await page.waitForTimeout(150); expect(requests).toHaveLength(before);
    release(); await expect(badge(page)).toHaveText('1');
    await expect(comments(page)).toHaveCount(1); await expect(cards(page)).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally { release(); }
});

test('a slow post-read GET neither blocks another read nor releases its pending POST guard', async ({ page }) => {
  const { state, writes, errors } = await setup(page);
  await open(page); await expect(cards(page)).toHaveCount(5);
  let releaseGet, releasePost;
  state.nextGetGate = new Promise(resolve => { releaseGet = resolve; });
  try {
    await comments(page).click(); await expect.poll(() => state.heldGets).toBe(1);
    await expect(markAll(page)).toBeEnabled();
    state.nextWriteGate = new Promise(resolve => { releasePost = resolve; });
    await markAll(page).click(); await expect.poll(() => writes.length).toBe(2);
    await expect(markAll(page)).toBeDisabled();
    releaseGet(); await expect.poll(() => state.finishedHeldGets).toBe(1);
    await page.waitForTimeout(150); await expect(markAll(page)).toBeDisabled();
    releasePost(); await expect(badge(page)).toHaveCount(0); await expect(cards(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { releaseGet(); if (releasePost) releasePost(); }
});
