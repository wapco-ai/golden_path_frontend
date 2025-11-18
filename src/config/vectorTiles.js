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

const buildFnMapFeaturesTileUrl = (entityTables = []) => {
  const params = new URLSearchParams();
  params.set('p_lang', DEFAULT_TILE_LANG);

  if (DEFAULT_TILE_FLOOR) {
    params.set('p_floor', DEFAULT_TILE_FLOOR);
  }

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
const MAP_FEATURES_ENTITY_TABLES = ['areas', 'doors', 'poi_points', 'van_nodes', 'qrcodes'];
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
  },
  {
    id: 'poi-points',
    titleFa: 'نقاط علاقه (POI)',
    table: 'public.fn_map_features',
    sourceId: MAP_FEATURES_SOURCE_ID,
    sourceLayer: MAP_FEATURES_SOURCE_LAYER,
    tileUrl: MAP_FEATURES_TILE_URL,
    type: 'symbol',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: true,
    layout: {
      'icon-image': 'marker-15',
      'icon-size': 1.1
    },
    filter: ['==', ['get', 'entity_table'], 'poi_points']
  },
  {
    id: 'qrcodes',
    titleFa: 'مکان‌های QR',
    table: 'public.fn_map_features',
    sourceId: MAP_FEATURES_SOURCE_ID,
    sourceLayer: MAP_FEATURES_SOURCE_LAYER,
    tileUrl: MAP_FEATURES_TILE_URL,
    type: 'symbol',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    layout: {
      'icon-image': 'marker-15',
      'icon-size': 1
    },
    filter: ['==', ['get', 'entity_table'], 'qrcodes']
  },
  {
    id: 'admin-restrictions',
    titleFa: 'محدودیت‌های مدیریتی',
    table: 'public.admin_restrictions',
    sourceId: 'admin-restrictions',
    sourceLayer: 'public.admin_restrictions',
    tileUrl: `${TILE_BASE_URL}/public.admin_restrictions/{z}/{x}/{y}.pbf`,
    type: 'fill',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    paint: {
      'fill-color': '#ef4444',
      'fill-opacity': 0.25
    }
  },
  {
    id: 'van-edges',
    titleFa: 'مسیر ون‌ها (خطوط)',
    table: 'public.van_edges',
    sourceId: 'van-edges',
    sourceLayer: 'public.van_edges',
    tileUrl: `${TILE_BASE_URL}/public.van_edges/{z}/{x}/{y}.pbf`,
    type: 'line',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    paint: {
      'line-color': '#22c55e',
      'line-width': 2,
      'line-dasharray': [1.5, 1.5]
    }
  },
  {
    id: 'van-nodes',
    titleFa: 'گره‌های ون',
    table: 'public.fn_map_features',
    sourceId: MAP_FEATURES_SOURCE_ID,
    sourceLayer: MAP_FEATURES_SOURCE_LAYER,
    tileUrl: MAP_FEATURES_TILE_URL,
    type: 'symbol',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    layout: {
      'icon-image': 'marker-15',
      'icon-size': 0.9
    },
    filter: ['==', ['get', 'entity_table'], 'van_nodes']
  },
  {
    id: 'mesh-triangles',
    titleFa: 'شبکه مسیریابی (Mesh)',
    table: 'public.mesh_triangles',
    sourceId: 'mesh-triangles',
    sourceLayer: 'public.mesh_triangles',
    tileUrl: `${TILE_BASE_URL}/public.mesh_triangles/{z}/{x}/{y}.pbf`,
    type: 'fill',
    minzoom: 18,
    maxzoom: 22,
    visibleByDefault: false,
    paint: {
      'fill-color': '#f97316',
      'fill-opacity': 0.15
    }
  }
];

export default haramVectorTileConfig;
