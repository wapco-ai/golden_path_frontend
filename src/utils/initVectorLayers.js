import { haramVectorTileConfig } from '../config/vectorTiles';
import { getSessionFloor, subscribeToSessionFloor } from './sessionFloor';

const resolveTileUrlResolver = (layerCfg) => {
  if (typeof layerCfg.tileUrlFactory === 'function') {
    return layerCfg.tileUrlFactory;
  }
  const staticUrl = layerCfg.tileUrl;
  return () => staticUrl;
};

const buildSourceMeta = (vectorTileConfig) => vectorTileConfig.reduce((acc, layerCfg) => {
  const existing = acc[layerCfg.sourceId];
  const isDynamic = typeof layerCfg.tileUrlFactory === 'function';
  const tileUrlResolver = resolveTileUrlResolver(layerCfg);

  if (!existing) {
    acc[layerCfg.sourceId] = {
      tileUrlResolver,
      minzoom: layerCfg.minzoom,
      maxzoom: layerCfg.maxzoom,
      isDynamic
    };
  } else {
    existing.minzoom = Math.min(existing.minzoom, layerCfg.minzoom);
    existing.maxzoom = Math.max(existing.maxzoom, layerCfg.maxzoom);

    if (isDynamic && !existing.isDynamic) {
      existing.tileUrlResolver = tileUrlResolver;
      existing.isDynamic = true;
    }
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
  circle: {
    'circle-color': '#0f172a',
    'circle-radius': 4,
    'circle-stroke-color': '#ffffff',
    // 'circle-stroke-width': 1
  },
  symbol: {}
};

const defaultLayoutByType = {
  fill: {},
  line: {},
  circle: {},
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

const ensureSourcesAndLayers = (map, vectorTileConfig, sourceMeta) => {
  if (!map || typeof map.addSource !== 'function') {
    return;
  }

  const currentFloor = getSessionFloor();

  Object.entries(sourceMeta).forEach(([sourceId, meta]) => {
    if (map.getSource(sourceId)) {
      if (meta.isDynamic) {
        const source = map.getSource(sourceId);
        if (source && typeof source.setTiles === 'function') {
          source.setTiles([meta.tileUrlResolver({ floor: currentFloor })]);
        }
      }
      return;
    }

    map.addSource(sourceId, {
      type: 'vector',
      tiles: [meta.tileUrlResolver({ floor: currentFloor })],
      minzoom: meta.minzoom,
      maxzoom: meta.maxzoom
    });
  });

  vectorTileConfig.forEach((layerCfg) => {
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

    if (layerCfg.filter) {
      layer.filter = layerCfg.filter;
    }

    map.addLayer(layer);
    const layerNameForLog = layerCfg?.sourceLayer || layerCfg?.id;
    if (layerNameForLog) {
      console.log(`Haram vector layer loaded: ${layerNameForLog}`);
    }
  });
};

const ensureFloorSync = (map, sourceMeta) => {
  if (!map) {
    return;
  }

  if (!map.__haramFloorCleanup) {
    map.__haramFloorCleanup = subscribeToSessionFloor((floor) => {
      Object.entries(sourceMeta).forEach(([sourceId, meta]) => {
        if (!meta.isDynamic) {
          return;
        }
        const source = map.getSource(sourceId);
        if (source && typeof source.setTiles === 'function') {
          source.setTiles([meta.tileUrlResolver({ floor })]);
        }
      });
    });

    if (typeof map.on === 'function') {
      map.on('remove', () => {
        if (typeof map.__haramFloorCleanup === 'function') {
          map.__haramFloorCleanup();
          map.__haramFloorCleanup = null;
        }
      });
    }
  }
};

export const initHaramVectorLayers = (mapOrEventTarget, vectorTileConfig = haramVectorTileConfig) => {
  const map = resolveMap(mapOrEventTarget?.target || mapOrEventTarget);
  if (!map) {
    return;
  }

  const sourceMeta = buildSourceMeta(vectorTileConfig);

  ensureSourcesAndLayers(map, vectorTileConfig, sourceMeta);
  ensureFloorSync(map, sourceMeta);

  if (!map[FLAG_KEY] && typeof map.on === 'function') {
    map[FLAG_KEY] = true;
    map.on('styledata', () => ensureSourcesAndLayers(map, vectorTileConfig, sourceMeta));
  }
};
