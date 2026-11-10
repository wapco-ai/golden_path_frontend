import { test, expect } from '@playwright/test';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';

const [lon, lat] = [59.6161, 36.2888];
const area = {
  type: 'Feature',
  properties: { id: 1, floor: 0 },
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [lon, lat - 0.00005], [lon + 0.00005, lat - 0.00005],
      [lon + 0.00005, lat + 0.00005], [lon, lat + 0.00005], [lon, lat - 0.00005]
    ]]
  }
};
const accessPoint = {
  type: 'Feature',
  properties: { id: 2, floor: 0 },
  geometry: { type: 'Point', coordinates: [lon, lat] }
};
const areaTiles = geojsonvt(area, { maxZoom: 22 });
const accessTiles = geojsonvt(accessPoint, { maxZoom: 22 });

test.use({ reducedMotion: 'reduce' });

test('the admin map keeps real vector layers visible at zoom 24 using zoom-22 tiles', async ({ page }) => {
  const requestedZooms = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('gp_admin_access_token', 'browser-fixture-only');
  });
  await page.route('**/api/v1/**', async route => {
    const { pathname } = new URL(route.request().url());
    let data = { data: [], total: 0 };
    if (pathname.endsWith('/admin/auth/me')) {
      data = { id: 1, roles: ['super_dashboard_admin', 'manage_map'], permissions: [] };
    } else if (pathname.endsWith('/floors')) {
      data = [{ floor: 0, label: 'همکف' }];
    }
    await route.fulfill({ json: data });
  });
  await page.route('**/map-styles/**/style*.json', route => route.fulfill({
    json: {
      version: 8,
      sources: { basemap: { type: 'geojson', data: area } },
      layers: [{ id: 'basemap', type: 'fill', source: 'basemap', maxzoom: 24 }]
    }
  }));
  await page.route('**/tiles/**', route => {
    const [, source, zoom, x, file] = new URL(route.request().url()).pathname.split('/').filter(Boolean);
    const z = Number(zoom);
    const fixture = {
      'public.fn_areas_mvt': ['areas', areaTiles],
      'public.fn_door_access_points_mvt': ['door_access_points', accessTiles]
    }[source];
    if (!fixture) return route.fulfill({ status: 204 });
    requestedZooms.push(z);
    const [name, tiles] = fixture;
    const tile = tiles.getTile(z, Number(x), Number(file.replace('.pbf', '')));
    if (!tile) return route.fulfill({ status: 204 });
    return route.fulfill({
      contentType: 'application/vnd.mapbox-vector-tile',
      body: Buffer.from(vtpbf.fromGeojsonVt({ [name]: tile }))
    });
  });

  await page.goto('/#/admin');
  await page.evaluate(async () => {
    const source = await (await fetch('/src/AdminPanel/Amain.jsx')).text();
    const modulePath = source.match(/["']([^"']*\/maplibre-gl\.js\?[^"']+)["']/)?.[1];
    const { default: maplibre } = await import(modulePath);
    const addControl = maplibre.Map.prototype.addControl;
    maplibre.Map.prototype.addControl = function (...args) {
      if (this.getContainer().id === 'map-container') window.__testAdminMap = this;
      return addControl.apply(this, args);
    };
  });
  await page.getByText('مدیریت نقشه', { exact: true }).click();

  const visibleLayers = async () => page.evaluate(() => {
    const map = window.__testAdminMap;
    const layers = ['basemap', 'areas-outline', 'areas-fill', 'doors-access-point'];
    if (!map || layers.some(id => !map.getLayer(id))) return [];
    return [...new Set(map.queryRenderedFeatures(undefined, { layers }).map(feature => feature.layer.id))].sort();
  });
  const expected = ['areas-fill', 'areas-outline', 'basemap', 'doors-access-point'];
  await expect.poll(visibleLayers).toEqual(expected);

  const zoomIn = page.getByRole('button', { name: 'بزرگ‌نمایی نقشه', exact: true });
  for (let zoom = 17; zoom <= 24; zoom++) {
    await zoomIn.click();
    await expect.poll(() => page.evaluate(() => window.__testAdminMap.getZoom())).toBeCloseTo(zoom, 5);
  }
  await expect.poll(visibleLayers).toEqual(expected);
  expect(Math.max(...requestedZooms)).toBe(22);
});
