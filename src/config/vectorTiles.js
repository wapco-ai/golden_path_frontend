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

const DEFAULT_VECTOR_TILE_FLOOR = 0;
const VECTOR_FUNCTION_SOURCE_LAYER = 'public.fn_map_features_mvt';
const VECTOR_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${VECTOR_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;
const AREAS_FUNCTION_SOURCE_LAYER = 'public.areas_mvt';
const AREAS_VECTOR_LAYER_NAME = 'areas';
const AREAS_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${AREAS_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;
const DOORS_SOURCE_LAYER = 'public.doors';
const DOORS_TILE_URL = `${TILE_BASE_URL}/${DOORS_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;

const normalizeFloorValue = (floor) => {
  if (typeof floor === 'number' && !Number.isNaN(floor)) {
    return floor;
  }

  if (typeof floor === 'string' && floor.trim() !== '') {
    const parsed = Number(floor);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return DEFAULT_VECTOR_TILE_FLOOR;
};

const buildFnTileUrlFactory = ({ entityTables }) => {
  const normalizedEntities = Array.isArray(entityTables)
    ? entityTables.filter(Boolean).join(',')
    : entityTables;

  return ({ floor } = {}) => {
    const params = new URLSearchParams();

    if (DEFAULT_TILE_LANG) {
      params.set('p_lang', DEFAULT_TILE_LANG);
    }

    const fallbackFloor = typeof floor !== 'undefined' ? floor : DEFAULT_TILE_FLOOR;
    params.set('p_floor', normalizeFloorValue(fallbackFloor));

    if (DEFAULT_TILE_GENDER) {
      params.set('p_gender', DEFAULT_TILE_GENDER);
    }

    if (normalizedEntities) {
      params.set('p_entity_tables', normalizedEntities);
    }

    return `${VECTOR_FUNCTION_TILE_BASE}?${params.toString()}`;
  };
};

const buildAreasTileUrlFactory = () => ({ floor } = {}) => {
  const params = new URLSearchParams();
  const fallbackFloor = typeof floor !== 'undefined' ? floor : DEFAULT_TILE_FLOOR;
  params.set('p_floor', normalizeFloorValue(fallbackFloor));

  return `${AREAS_FUNCTION_TILE_BASE}?${params.toString()}`;
};

export const haramVectorTileConfig = [
  {
    id: 'areas-outline',
    titleFa: 'مرز محدوده‌ها',
    table: 'public.areas',
    sourceId: 'areas',
    sourceLayer: AREAS_VECTOR_LAYER_NAME,
    tileUrlFactory: buildAreasTileUrlFactory(),
    type: 'fill',
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'fill-color': 'rgba(0, 0, 0, 0)',
      'fill-outline-color': '#000000',
      'fill-opacity': 1
    }
  },
  {
    id: 'doors',
    titleFa: 'درب‌ها',
    table: 'public.doors',
    sourceId: 'doors',
    sourceLayer: DOORS_SOURCE_LAYER,
    tileUrl: DOORS_TILE_URL,
    type: 'line',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#ff3b30',
      'line-width': 2
    }
  }
];

export default haramVectorTileConfig;
