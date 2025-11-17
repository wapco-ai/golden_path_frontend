import { haramVectorTileConfig } from '../config/vectorTiles';

const sourceMeta = haramVectorTileConfig.reduce((acc, layerCfg) => {
  const existing = acc[layerCfg.sourceId];
  if (!existing) {
    acc[layerCfg.sourceId] = {
      tileUrl: layerCfg.tileUrl,
      minzoom: layerCfg.minzoom,
      maxzoom: layerCfg.maxzoom
    };
  } else {
    existing.minzoom = Math.min(existing.minzoom, layerCfg.minzoom);
    existing.maxzoom = Math.max(existing.maxzoom, layerCfg.maxzoom);
  }
  return acc;
}, {});

const defaultPaintByType = {
  fill: {
    'fill-color': '#0f172a',
    'fill-opacity': 0.2
  },
  line: {
    'line-color': '#0f172a',
    'line-width': 1
  },
  symbol: {}
};

const defaultLayoutByType = {
  fill: {},
  line: {},
  symbol: {
    'icon-image': 'marker-15',
    'icon-size': 1
  }
};

const FLAG_KEY = '__haramVectorTilesBound';

const resolveMap = (mapOrRef) => {
  if (!mapOrRef) return null;
  if (typeof mapOrRef.getMap === 'function') {
    return mapOrRef.getMap();
  }
  return mapOrRef;
};

const ensureSourcesAndLayers = (map) => {
  if (!map || typeof map.addSource !== 'function') {
    return;
  }

  Object.entries(sourceMeta).forEach(([sourceId, meta]) => {
    if (map.getSource(sourceId)) {
      return;
    }

    map.addSource(sourceId, {
      type: 'vector',
      tiles: [meta.tileUrl],
      minzoom: meta.minzoom,
      maxzoom: meta.maxzoom
    });
  });

  haramVectorTileConfig.forEach((layerCfg) => {
    if (map.getLayer(layerCfg.id)) {
      return;
    }

    const baseLayout = {
      visibility: layerCfg.visibleByDefault ? 'visible' : 'none',
      ...defaultLayoutByType[layerCfg.type],
      ...(layerCfg.layout || {})
    };

    const layer = {
      id: layerCfg.id,
      type: layerCfg.type,
      source: layerCfg.sourceId,
      'source-layer': layerCfg.sourceLayer,
      minzoom: layerCfg.minzoom,
      maxzoom: layerCfg.maxzoom,
      paint: layerCfg.paint || defaultPaintByType[layerCfg.type],
      layout: baseLayout
    };

    map.addLayer(layer);
  });
};

export const initHaramVectorLayers = (mapOrEventTarget) => {
  const map = resolveMap(mapOrEventTarget?.target || mapOrEventTarget);
  if (!map) {
    return;
  }

  ensureSourcesAndLayers(map);

  if (!map[FLAG_KEY] && typeof map.on === 'function') {
    map[FLAG_KEY] = true;
    map.on('styledata', () => ensureSourcesAndLayers(map));
  }
};
