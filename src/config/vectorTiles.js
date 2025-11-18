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

<<<<<<< Updated upstream
<<<<<<< Updated upstream
<<<<<<< Updated upstream
const buildFnTileUrlFactory = ({ entityTables }) => {
  const normalizedEntities = Array.isArray(entityTables)
    ? entityTables.filter(Boolean).join(',')
    : entityTables;
=======
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
const buildFloorFilteredTileUrlFactory = (tableName, paramName = 'p_floor') => {
  const baseUrl = buildTableTileUrl(tableName);
  return ({ floor } = {}) => {
    const safeFloor = normalizeFloorValue(floor);
    const connector = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${connector}${encodeURIComponent(paramName)}=${encodeURIComponent(safeFloor)}`;
  };
};
>>>>>>> Stashed changes

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

export const haramVectorTileConfig = [
  {
    id: 'areas-outline',
    titleFa: 'مرز محدوده‌ها',
    table: 'public.fn_map_features_mvt',
    sourceId: 'areas',
<<<<<<< Updated upstream
    // All features are now served through the fn_map_features_mvt function,
    // so the source-layer must match the function name exposed by Tegola.
    sourceLayer: VECTOR_FUNCTION_SOURCE_LAYER,
    tileUrlFactory: buildFnTileUrlFactory({ entityTables: 'areas' }),
=======
    // Source layer name must match exactly what the vector tile server encodes.
    // Tegola/PostGIS exports often keep the schema prefix (e.g. "public.areas"),
    // so we default to the fully-qualified table name instead of a stripped alias
    // to ensure the layer becomes visible even when schemas are included.
    sourceLayer: 'public.fn_map_features_mvt',
    tileUrl: TABLE_TILE_URLS.areas,
    tileUrlFactory: buildFloorFilteredTileUrlFactory('areas'),
>>>>>>> Stashed changes
    type: 'line',
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#000000',
      'line-width': 1.5
    }
  },
  {
    id: 'doors',
    titleFa: 'درب‌ها',
    table: 'public.doors',
    sourceId: 'doors',
    sourceLayer: VECTOR_FUNCTION_SOURCE_LAYER,
    tileUrlFactory: buildFnTileUrlFactory({ entityTables: 'doors' }),
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
