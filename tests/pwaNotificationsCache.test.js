import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from '@playwright/test';

const distDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const notificationPath = '/api/v1/admin/dashboard/notifications';
const notificationQuery = '?limit=10&unreadOnly=true&includeMeta=true';
const harnessPath = '/__pwa-notifications-cache-test__.html';
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

test('production service worker never replays cached auth profiles or admin notifications and keeps public API caching',
  { timeout: 60000 }, async (t) => {
    const swFile = resolve(distDirectory, 'sw.js');
    await assert.doesNotReject(stat(swFile),
      'The production service worker is missing. Run npm run build before npm run test:pwa-cache.');

    const staleNotifications = {
      items: [{ id: 'new_comment:71', title: 'Already acknowledged by another administrator', read: false }],
      unreadCount: 5,
      total: 5,
      administrator: 'previous-admin',
      version: 'before-acknowledgement'
    };
    const freshNotifications = {
      items: [],
      unreadCount: 0,
      total: 0,
      administrator: 'current-admin',
      version: 'after-acknowledgement'
    };
    const genericResponse = { data: ['unchanged generic API cache'], revision: 1 };
    const staleProfile = { id: 41, phone: '09120000041', fullName: 'Previous user' };
    const freshProfile = { id: 42, phone: '09120000042', fullName: 'Current user' };
    const notificationRequests = [];
    const profileRequests = [];
    let genericRequestCount = 0;
    const server = createServer(async (request, response) => {
      const url = new URL(request.url, 'http://localhost');
      if (request.method !== 'GET') {
        response.writeHead(405).end();
        return;
      }
      if (url.pathname === notificationPath) {
        notificationRequests.push({ search: url.search, authorization: request.headers.authorization });
        response.writeHead(200, { 'Content-Type': contentTypes['.json'], 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(freshNotifications));
        return;
      }
      if (url.pathname === '/api/v1/auth/me') {
        profileRequests.push(request.headers.authorization);
        response.writeHead(200, { 'Content-Type': contentTypes['.json'] });
        response.end(JSON.stringify(freshProfile));
        return;
      }
      if (url.pathname === '/api/v1/pwa-cache-control') {
        genericRequestCount += 1;
        response.writeHead(200, { 'Content-Type': contentTypes['.json'] });
        response.end(JSON.stringify(genericResponse));
        return;
      }
      if (url.pathname === harnessPath) {
        // This document deliberately loads no application bundle and is not precached.
        response.writeHead(200, { 'Content-Type': contentTypes['.html'], 'Cache-Control': 'no-store' });
        response.end('<!doctype html><html><head><title>PWA cache regression</title></head><body></body></html>');
        return;
      }
      try {
        const pathname = decodeURIComponent(url.pathname);
        const file = resolve(distDirectory, `.${pathname}`);
        if (!file.startsWith(`${distDirectory}${sep}`)) {
          response.writeHead(403).end();
          return;
        }
        const contents = await readFile(file);
        response.writeHead(200, {
          'Content-Type': contentTypes[extname(file)] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        response.end(contents);
      } catch {
        response.writeHead(404).end();
      }
    });
    let browser;
    t.after(async () => {
      await browser?.close();
      server.closeAllConnections();
      await new Promise((resolveClose, rejectClose) => server.close((error) => (
        error ? rejectClose(error) : resolveClose()
      )));
    });
    await new Promise((resolveListening, rejectListening) => {
      server.once('error', rejectListening);
      server.listen(0, '127.0.0.1', resolveListening);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const notificationUrl = `${origin}${notificationPath}${notificationQuery}`;
    const uncachedNotificationUrl = `${origin}${notificationPath}?limit=5&unreadOnly=true&includeMeta=true`;
    const genericUrl = `${origin}/api/v1/pwa-cache-control`;
    const profileUrl = `${origin}/api/v1/auth/me`;
    const uncachedProfileUrl = `${profileUrl}?login-check=1`;

    browser = await chromium.launch({
      ...(process.env.GP_TEST_CHROMIUM ? { executablePath: process.env.GP_TEST_CHROMIUM } : {}),
      args: ['--no-sandbox']
    });
    const context = await browser.newContext({ serviceWorkers: 'allow' });
    const page = await context.newPage();
    await page.goto(`${origin}${harnessPath}`);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolveControlled, rejectControlled) => {
          const timeout = setTimeout(() => rejectControlled(new Error('Production service worker did not take control')), 15000);
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            clearTimeout(timeout);
            resolveControlled();
          }, { once: true });
        });
      }
    });
    assert.equal(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)), true,
      'The test must run through the generated production service worker.');

    await page.evaluate(async ({ url, stale }) => {
      const cache = await caches.open('api-cache');
      await cache.put(new Request(url, { headers: { Authorization: 'Bearer previous-admin-token' } }),
        new Response(JSON.stringify(stale), { headers: { 'Content-Type': 'application/json' } }));
    }, { url: notificationUrl, stale: staleNotifications });
    await page.evaluate(async ({ url, stale }) => {
      const cache = await caches.open('api-cache');
      await cache.put(new Request(url, { headers: { Authorization: 'Bearer previous-user-token' } }),
        new Response(JSON.stringify(stale), { headers: { 'Content-Type': 'application/json' } }));
    }, { url: profileUrl, stale: staleProfile });

    await context.setOffline(true);
    const offlineNotifications = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, { headers: { Authorization: 'Bearer current-admin-token' } });
        return { fulfilled: true, body: await response.json() };
      } catch (error) {
        return { fulfilled: false, errorName: error.name };
      }
    }, notificationUrl);
    assert.deepEqual(offlineNotifications, { fulfilled: false, errorName: 'TypeError' },
      'Offline notifications must fail, even if api-cache holds a stale response for another administrator.');
    assert.equal(notificationRequests.length, 0, 'Offline requests must not reach the HTTP server.');
    const offlineProfile = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, { headers: { Authorization: 'Bearer new-user-token' } });
        return { fulfilled: true, body: await response.json() };
      } catch (error) {
        return { fulfilled: false, errorName: error.name };
      }
    }, profileUrl);
    assert.deepEqual(offlineProfile, { fulfilled: false, errorName: 'TypeError' },
      'A new login must fail instead of accepting the previous user profile from api-cache.');
    assert.equal(profileRequests.length, 0);

    await context.setOffline(false);
    const onlineNotifications = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => {
      const response = await fetch(url, { headers: { Authorization: 'Bearer current-admin-token' } });
      return { status: response.status, body: await response.json() };
    })), [notificationUrl, uncachedNotificationUrl]);
    for (const result of onlineNotifications) {
      assert.deepEqual(result, { status: 200, body: freshNotifications },
        'Online notification metadata must come from the current authenticated network response.');
    }
    assert.equal(notificationRequests.length, 2);
    assert.ok(notificationRequests.every(({ authorization }) => authorization === 'Bearer current-admin-token'));
    assert.ok(notificationRequests.some(({ search }) => search === notificationQuery));
    const onlineProfiles = await page.evaluate(async (urls) => Promise.all(urls.map(async (url) => {
      const response = await fetch(url, { headers: { Authorization: 'Bearer new-user-token' } });
      return response.json();
    })), [profileUrl, uncachedProfileUrl]);
    assert.deepEqual(onlineProfiles, [freshProfile, freshProfile]);
    assert.deepEqual(profileRequests, ['Bearer new-user-token', 'Bearer new-user-token']);

    assert.deepEqual(await page.evaluate(async (url) => (await fetch(url)).json(), genericUrl), genericResponse);
    await page.waitForFunction(async (url) => Boolean(await (await caches.open('api-cache')).match(url)), genericUrl);
    await context.setOffline(true);
    assert.deepEqual(await page.evaluate(async (url) => (await fetch(url)).json(), genericUrl), genericResponse,
      'The existing NetworkFirst cache fallback for other API routes must remain available offline.');
    assert.equal(genericRequestCount, 1);

    const notificationCache = await page.evaluate(async ({ existingUrl, newUrl }) => {
      const cache = await caches.open('api-cache');
      const existing = await cache.match(existingUrl);
      return { existing: existing ? await existing.json() : null, newEntry: Boolean(await cache.match(newUrl)) };
    }, { existingUrl: notificationUrl, newUrl: uncachedNotificationUrl });
    assert.deepEqual(notificationCache.existing, staleNotifications,
      'NetworkOnly must not overwrite the previously cached notification response.');
    assert.equal(notificationCache.newEntry, false,
      'Successful online notification requests must not populate api-cache.');
    const profileCache = await page.evaluate(async ({ existingUrl, newUrl }) => {
      const cache = await caches.open('api-cache');
      const existing = await cache.match(existingUrl);
      return { existing: existing ? await existing.json() : null, newEntry: Boolean(await cache.match(newUrl)) };
    }, { existingUrl: profileUrl, newUrl: uncachedProfileUrl });
    assert.deepEqual(profileCache.existing, staleProfile);
    assert.equal(profileCache.newEntry, false,
      'Successful authentication reads must not populate api-cache.');
  });
