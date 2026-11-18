import { test, expect } from '@playwright/test';

const coordinates = [[59.615, 36.287], [59.6154, 36.2874]];
const state = {
  origin: { name: 'مبدأ آزمایشی', floor: 0, coordinates: [36.287, 59.615] },
  destination: { name: 'مقصد آزمایشی', floor: 0, coordinates: [36.2874, 59.6154] },
  routeGeo: {
    type: 'Feature', geometry: { type: 'LineString', coordinates },
    properties: { floor: 0, distanceMeters: 60, durationSeconds: 50 }
  },
  routeSteps: [{ type: 'stepStart', floor: 0, coordinates: [[36.287, 59.615], [36.2874, 59.6154]] }],
  alternativeRoutes: [], transportMode: 'walking', gender: 'both'
};

async function openResult(page, { mapType = 'base', language = 'fa', failStyle = false, failEngineering = false } = {}) {
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push(new URL(request.url()).pathname));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ state, mapType, language }) => {
    if (mapType !== null) sessionStorage.setItem('selectedMapType', mapType);
    sessionStorage.setItem('haramCurrentFloor', '0');
    localStorage.setItem('lang-storage', JSON.stringify({ state: { language }, version: 1 }));
    localStorage.setItem('route-storage', JSON.stringify({ state, version: 1 }));
  }, { state, mapType, language });
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/floors')
      ? [{ floor: 0, label: 'همکف' }, { floor: -1, label: 'منفی ۱' }]
      : path.endsWith('/routing/route')
        ? { geo: state.routeGeo, steps: state.routeSteps, alternatives: [], estimatedMinutes: 1, distanceMeters: 60 }
        : { status: 'NO_MATCH', data: [], features: [] }
    });
  });
  await page.route('**/map-styles/**/style*.json', route => failStyle
    ? route.fulfill({ status: 503, body: 'Unavailable' })
    : route.fulfill({ json: {
      version: 8, name: new URL(route.request().url()).pathname, sources: {},
      layers: [{ id: 'test-background', type: 'background', paint: { 'background-color': '#e8e5dd' } }]
    } }));
  await page.route('**/tiles/**', route => route.fulfill({ status:
    failEngineering && route.request().url().includes('/public.fn_public_engineering_map_mvt/') ? 503 : 204
  }));
  await page.route('**/tms/**', route => route.fulfill({ status: 204 }));
  await page.route('**/fonts/**', route => route.fulfill({ status: 204 }));
  // Observe the actual MapLibre style after React creates or replaces the map.
  await page.goto('/#/');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/pages/FinalSearch.jsx')).text();
    const modulePath = source.match(/["']([^"']*\/maplibre-gl\.js\?[^"']+)["']/)?.[1];
    const { default: maplibre } = await import(modulePath);
    const addSource = maplibre.Map.prototype.addSource;
    maplibre.Map.prototype.addSource = function (...args) {
      window.resultMap = this;
      return addSource.apply(this, args);
    };
    location.hash = '/fs';
  });
  await expect(page.locator('.gp-floor-trigger')).toBeVisible();
  return { requests, errors };
}

const styleName = page => page.evaluate(() => window.resultMap?.getStyle()?.name);
const expectedStyle = mapType => mapType === 'base'
  ? 'engineering-map'
  : mapType === 'simple' ? '/map-styles/osm-basic/style.json' : 'mbtiles-satellite';

async function chooseFloor(page, name) {
  await page.locator('.gp-floor-trigger').click();
  await page.locator('.gp-floor-option').filter({ hasText: name }).click();
}

for (const mapType of ['base', 'simple', 'satellite']) {
  for (const language of ['fa', 'en']) {
    test(`result preserves ${mapType} ${language} through reload`, async ({ page }, testInfo) => {
      const { requests, errors } = await openResult(page, { mapType, language });
      await expect.poll(() => styleName(page)).toBe(expectedStyle(mapType));
      await expect.poll(() => page.evaluate(() => Boolean(window.resultMap?.getSource('main-route')))).toBe(true);
      if (mapType !== 'satellite') expect(requests.some(path => path.includes('/tms/services/gsm/'))).toBe(false);
      expect(await page.evaluate(() => sessionStorage.getItem('selectedMapType'))).toBe(mapType);
      await page.screenshot({ path: testInfo.outputPath(`${mapType}-${language}.png`) });
      // The observer is deliberately not persisted across a reload; verify requests from the new page.
      const nextRequest = page.waitForRequest(request => {
        const url = new URL(request.url());
        if (mapType === 'base') return url.pathname.includes('/public.fn_public_engineering_map_mvt/')
          && url.searchParams.get('p_floor') === '0' && url.searchParams.get('p_lang') === language;
        return mapType === 'satellite' ? url.pathname.includes('/tms/services/gsm/')
          : url.pathname === expectedStyle(mapType);
      });
      await page.reload();
      await nextRequest;
      expect(await page.evaluate(() => sessionStorage.getItem('selectedMapType'))).toBe(mapType);
      expect(errors).toEqual([]);
    });
  }

  test(`result restores ${mapType} after a basement round trip`, async ({ page }) => {
    const { errors } = await openResult(page, { mapType });
    await expect.poll(() => styleName(page)).toBe(expectedStyle(mapType));
    await chooseFloor(page, 'منفی ۱');
    await expect.poll(() => styleName(page)).toBe('engineering-map');
    await expect.poll(() => page.evaluate(() => window.resultMap?.getStyle()?.sources['engineering-areas']?.tiles[0])).toContain('p_floor=-1');
    await chooseFloor(page, 'همکف');
    await expect.poll(() => styleName(page)).toBe(expectedStyle(mapType));
    if (mapType === 'base') await expect.poll(() => page.evaluate(() =>
      window.resultMap?.getStyle()?.sources['engineering-areas']?.tiles[0])).toContain('p_floor=0');
    expect(await page.evaluate(() => sessionStorage.getItem('selectedMapType'))).toBe(mapType);
    expect(errors).toEqual([]);
  });
}

for (const mapType of [null, 'invalid']) {
  test(`result defaults to satellite for ${mapType === null ? 'missing' : 'invalid'} selection`, async ({ page }) => {
    const { errors } = await openResult(page, { mapType });
    await expect.poll(() => styleName(page)).toBe('mbtiles-satellite');
    expect(errors).toEqual([]);
  });
}

for (const mapType of ['simple']) {
  test(`result uses the existing offline fallback when ${mapType} fails`, async ({ page }) => {
    const { requests, errors } = await openResult(page, { mapType, failStyle: true });
    await expect.poll(() => styleName(page)).toBe('offline-fallback');
    expect(requests.some(path => path.includes('/tms/services/gsm/'))).toBe(false);
    expect(await page.evaluate(() => sessionStorage.getItem('selectedMapType'))).toBe(mapType);
    expect(errors).toEqual([]);
  });
}

test('result keeps the engineering base when its tiles fail', async ({ page }) => {
  const { requests, errors } = await openResult(page, { mapType: 'base', failEngineering: true });
  await expect(page.getByText('بارگذاری نقشهٔ مهندسی ناموفق بود.', { exact: true }).first()).toBeVisible();
  await expect.poll(() => styleName(page)).toBe('engineering-map');
  expect(requests.some(path => path.includes('/tms/services/gsm/'))).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('selectedMapType'))).toBe('base');
  expect(errors).toEqual([]);
});
