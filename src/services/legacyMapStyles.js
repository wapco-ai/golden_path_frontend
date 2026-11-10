const legacyStylePath = /^\/?map-styles\/(osm-voyager|osm-basic|osm-streets-3d)\/style(?:-en)?\.json$/;
const styleProtocol = 'goldenpath-style';
const adminStylePrefix = '/admin';
const previousAdminMaxZoom = 22;
export const ADMIN_MAP_MAX_ZOOM = 24;

export function extendAdminMapStyle(style) {
  return {
    ...style,
    layers: style.layers.map(({ maxzoom, ...layer }) => (
      maxzoom <= previousAdminMaxZoom ? { ...layer, maxzoom } : layer
    ))
  };
}

const legacyAssetPath = /^\/(?:map-styles\/(?:osm-voyager|osm-basic|osm-streets-3d)\/|fonts\/|tms\/services\/mashhad\/tiles\/)/;
const oldTilePath = /^\/services\/mashhad\/tiles\//;

function sameOriginUrl(url) {
  if (typeof url !== 'string' || url.startsWith('//')) return url;
  const resource = url.replace(/^https?:\/\/[^/?#]+/i, '');
  const path = /^(?:\.\/)?map-styles\//.test(resource)
    ? '/' + resource.replace(/^\.\//, '')
    : resource;

  // A browser may pair a new app bundle with an older cached style or TileJSON.
  if (oldTilePath.test(path)) return window.location.origin + '/tms' + path;
  if (url.startsWith('/') || legacyAssetPath.test(path)) return window.location.origin + path;
  return url;
}

export const isLegacyMapStyle = style => (
  typeof style === 'string' && legacyStylePath.test(style.replace(/^\.\//, '/'))
);

export function mapAssetRequest(url, type) {
  if (type === 'Style' && isLegacyMapStyle(url)) {
    return { url: `${styleProtocol}:///${url.replace(/^\.?\//, '')}` };
  }
  // Resolve TileJSON templates before the tile request reaches the map worker.
  return { url: sameOriginUrl(url) };
}

export function adminMapAssetRequest(url, type) {
  if (type === 'Style' && isLegacyMapStyle(url)) {
    return { url: `${styleProtocol}://${adminStylePrefix}/${url.replace(/^\.?\//, '')}` };
  }
  return mapAssetRequest(url, type);
}

export async function loadLegacyMapStyle(path, signal) {
  const response = await fetch(sameOriginUrl('/' + path.replace(/^\.?\//, '')), { cache: 'no-cache', signal });
  if (!response.ok) throw Object.assign(
    new Error(`Map style request failed (${response.status})`), { url: response.url }
  );
  const style = await response.json();
  return {
    ...style,
    // MapLibre 2.x appends the sprite suffix before calling transformRequest.
    ...(style.sprite ? { sprite: sameOriginUrl(style.sprite) } : {}),
    ...(style.glyphs ? { glyphs: sameOriginUrl(style.glyphs) } : {}),
    sources: Object.fromEntries(Object.entries(style.sources).map(([id, source]) => [
      id, source.url ? { ...source, url: sameOriginUrl(source.url) } : source
    ]))
  };
}

export function registerLegacyMapStyles(maplibre) {
  maplibre.addProtocol(styleProtocol, ({ url }, callback) => {
    const controller = new AbortController();
    const path = url.slice(styleProtocol.length + 3);
    const admin = path.startsWith(adminStylePrefix + '/');
    loadLegacyMapStyle(admin ? path.slice(adminStylePrefix.length) : path, controller.signal)
      .then(style => admin ? extendAdminMapStyle(style) : style)
      .then(
        style => { if (!controller.signal.aborted) callback(null, style); },
        error => { if (!controller.signal.aborted) callback(error); }
      );
    return { cancel: () => controller.abort() };
  });
}
