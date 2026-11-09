const legacyStylePath = /^\/?map-styles\/(osm-voyager|osm-basic|osm-streets-3d)\/style(?:-en)?\.json$/;
const styleProtocol = 'goldenpath-style';

const sameOriginUrl = url => (
  typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')
    ? window.location.origin + url
    : url
);

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

export async function loadLegacyMapStyle(path, signal) {
  const response = await fetch(sameOriginUrl('/' + path.replace(/^\.?\//, '')), { signal });
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
    loadLegacyMapStyle(url.slice(styleProtocol.length + 3), controller.signal).then(
      style => { if (!controller.signal.aborted) callback(null, style); },
      error => { if (!controller.signal.aborted) callback(error); }
    );
    return { cancel: () => controller.abort() };
  });
}
