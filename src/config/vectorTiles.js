const inferDefaultTileBaseUrl = () => {
  if (typeof window === 'undefined' || !window?.location?.origin) {
    return 'http://localhost:8080/tiles';
  }

  const { origin, hostname } = window.location;

  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${origin.replace(/\/$/, '')}/tiles`;
  }

  return 'http://localhost:8080/tiles';
};

export const TILE_BASE_URL = (import.meta?.env?.VITE_TILE_BASE_URL?.trim() || inferDefaultTileBaseUrl()).replace(/\/$/, '');
export const DEFAULT_TILE_LANG = import.meta?.env?.VITE_TILE_LANG?.trim() || 'fa';
export const DEFAULT_TILE_FLOOR = import.meta?.env?.VITE_TILE_FLOOR?.trim();
export const DEFAULT_TILE_GENDER = import.meta?.env?.VITE_TILE_GENDER?.trim();

const RESOLVED_TILE_FLOOR =
  DEFAULT_TILE_FLOOR !== undefined && DEFAULT_TILE_FLOOR !== '' ? DEFAULT_TILE_FLOOR : '0';

const buildFnMapFeaturesTileUrl = (entityTables = []) => {
  const params = new URLSearchParams();
  params.set('p_lang', DEFAULT_TILE_LANG);

  params.set('p_floor', RESOLVED_TILE_FLOOR);

  if (DEFAULT_TILE_GENDER) {
    params.set('p_gender', DEFAULT_TILE_GENDER);
  }

  if (entityTables.length) {
    params.set('p_entity_tables', entityTables.join(','));
  }

  return `${TILE_BASE_URL}/public.fn_map_features_mvt/{z}/{x}/{y}.pbf?${params.toString()}`;
};

const MAP_FEATURES_SOURCE_ID = 'map-features';
const MAP_FEATURES_SOURCE_LAYER = 'map_features';
const MAP_FEATURES_ENTITY_TABLES = ['areas', 'doors'];
const MAP_FEATURES_TILE_URL = buildFnMapFeaturesTileUrl(MAP_FEATURES_ENTITY_TABLES);

export const haramVectorTileConfig = [
  {
    id: 'areas-fill',
    titleFa: 'محدوده‌ها (ساده‌شده)',
    table: 'public.fn_map_features',
    sourceId: MAP_FEATURES_SOURCE_ID,
    sourceLayer: MAP_FEATURES_SOURCE_LAYER,
    tileUrl: MAP_FEATURES_TILE_URL,
    type: 'fill',
    minzoom: 14,
    maxzoom: 20,
    visibleByDefault: true,
    paint: {
      'fill-color': '#0f71ef',
      'fill-opacity': 0.2
    },
    filter: ['==', ['get', 'entity_table'], 'areas']
  },
  {
    id: 'areas-outline',
    titleFa: 'مرز محدوده‌ها',
    table: 'public.fn_map_features',
    sourceId: MAP_FEATURES_SOURCE_ID,
    sourceLayer: MAP_FEATURES_SOURCE_LAYER,
    tileUrl: MAP_FEATURES_TILE_URL,
    type: 'line',
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#0f71ef',
      'line-width': 1.5
    },
    filter: ['==', ['get', 'entity_table'], 'areas']
  },
  {
    id: 'doors',
    titleFa: 'درب‌ها',
    table: 'public.fn_map_features',
    sourceId: MAP_FEATURES_SOURCE_ID,
    sourceLayer: MAP_FEATURES_SOURCE_LAYER,
    tileUrl: MAP_FEATURES_TILE_URL,
    type: 'symbol',
    minzoom: 17,
    maxzoom: 22,
    visibleByDefault: true,
    layout: {
      'icon-image': 'marker-15',
      'icon-size': 1.2
    },
    filter: ['==', ['get', 'entity_table'], 'doors']
  }
];

export default haramVectorTileConfig;
