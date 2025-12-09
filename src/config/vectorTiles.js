import appConfig from './appConfig';

export const TILE_BASE_URL = appConfig.tileBaseUrl;
export const DEFAULT_TILE_LANG = import.meta?.env?.VITE_TILE_LANG?.trim() || 'fa';
export const DEFAULT_TILE_FLOOR = import.meta?.env?.VITE_TILE_FLOOR?.trim();
export const DEFAULT_TILE_GENDER = import.meta?.env?.VITE_TILE_GENDER?.trim();

const DEFAULT_VECTOR_TILE_FLOOR = 0;
const VECTOR_FUNCTION_SOURCE_LAYER = 'public.fn_map_features_mvt';
const VECTOR_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${VECTOR_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;
const AREAS_FUNCTION_SOURCE_LAYER = 'public.fn_areas_mvt';
const AREAS_VECTOR_LAYER_NAME = 'areas';
const AREAS_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${AREAS_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;
const DOORS_FUNCTION_SOURCE_LAYER = 'public.fn_doors_mvt';
const DOORS_VECTOR_LAYER_NAME = 'doors';
const DOORS_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${DOORS_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;
const MESH_TRIANGLES_SOURCE_LAYER = 'public.vw_mesh_triangles';
const MESH_TRIANGLES_TILE_BASE = `${TILE_BASE_URL}/${MESH_TRIANGLES_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;
const ROUTING_EDGES_STATIC_SOURCE_LAYER = 'public.routing_edges_static';
const ROUTING_EDGES_STATIC_BASE = `${TILE_BASE_URL}/${ROUTING_EDGES_STATIC_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;
const DOORS_ACCESS_POINT_SOURCE_LAYER = 'public.fn_door_access_points_mvt';
export const DOOR_ACCESS_LAYER_ID = 'doors-access-point';
// The MVT layer name returned by the function omits the schema prefix
export const DOORS_ACCESS_POINT_LAYER_NAME = 'door_access_points';
const DOORS_ACCESS_POINT_BASE = `${TILE_BASE_URL}/${DOORS_ACCESS_POINT_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;

const buildDoorAccessPointsTileUrlFactory = () => buildFloorOnlyTileUrlFactory(DOORS_ACCESS_POINT_BASE);

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

const buildFloorOnlyTileUrlFactory = (tileBaseUrl) => ({ floor } = {}) => {
  const params = new URLSearchParams();
  const fallbackFloor = typeof floor !== 'undefined' ? floor : DEFAULT_TILE_FLOOR;
  params.set('p_floor', normalizeFloorValue(fallbackFloor));

  return `${tileBaseUrl}?${params.toString()}`;
};

// const buildAreasTileUrlFactory = () => buildFloorOnlyTileUrlFactory(AREAS_FUNCTION_TILE_BASE);
const buildDoorsTileUrlFactory = () => buildFloorOnlyTileUrlFactory(DOORS_FUNCTION_TILE_BASE);

const buildAreasTileUrlFactory = () => ({ floor } = {}) => {
  const params = new URLSearchParams();

  if (DEFAULT_TILE_LANG) {
    params.set('p_lang', DEFAULT_TILE_LANG);
  }

  const fallbackFloor = typeof floor !== 'undefined' ? floor : DEFAULT_TILE_FLOOR;
  params.set('p_floor', normalizeFloorValue(fallbackFloor));

  if (DEFAULT_TILE_GENDER) {
    params.set('p_gender', DEFAULT_TILE_GENDER);
  }

  return `${AREAS_FUNCTION_TILE_BASE}?${params.toString()}`;
};


export const haramVectorTileConfig = [
  {
    id: 'areas-outline',
    titleFa: 'مرز محدوده‌ها',
    table: 'public.fn_areas_mvt',
    sourceId: 'fn_areas_mvt',
    sourceLayer: AREAS_VECTOR_LAYER_NAME,
    tileUrlFactory: buildAreasTileUrlFactory(),
    type: 'line',
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#d1c2fa',
      'line-width': 2
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    }
  },
  {
    id: 'areas-fill',
    titleFa: 'رنگ محدوده‌ها',
    table: 'public.fn_areas_mvt',
    sourceId: 'fn_areas_mvt',
    sourceLayer: 'areas',
    tileUrlFactory: buildAreasTileUrlFactory(),
    type: 'fill',
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: false,
    paint: {
      'fill-color': [
        'match',
        ['get', 'area_type'],
        'sahn', '#fff5cc',
        'ravaq', '#e6f2ff',
        'eyvan', '#ffe6e6',
        'masjed', '#e8e0ff',
      /* default */ '#dddddd'
      ],
      'fill-opacity': 0.35
    }
  },
  {
    id: 'areas-labels',
    titleFa: 'نام محدوده‌ها',
    table: 'public.fn_areas_mvt',
    sourceId: 'fn_areas_mvt',
    sourceLayer: AREAS_VECTOR_LAYER_NAME, // باید همونی باشه که در areas-outline استفاده می‌کنی
    tileUrlFactory: buildAreasTileUrlFactory(),
    type: 'symbol',
    minzoom: 16,
    maxzoom: 22,
    visibleByDefault: false,
    layout: {
      'text-field': ['get', 'label'],          // یا name_fa، بسته به پراپرتی MVT
      'text-font': ['Vazirmatn Regular'],     // دقیقا اسم فولدر glyphها
      'text-size': 13,
      'text-anchor': 'center',
      'text-allow-overlap': true
    },
    paint: {
      'text-color': '#222222',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.2
    }
  },
  ,
  {
    id: 'doors',
    titleFa: 'درب‌ها',
    table: 'public.fn_doors_mvt',
    sourceId: 'fn_doors_mvt',
    sourceLayer: DOORS_VECTOR_LAYER_NAME,
    tileUrlFactory: buildDoorsTileUrlFactory(),
    type: 'line',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#ff3b30',
      'line-width': 2
    }
  }
]

////////////////////////////////////////////////////////////////////////////////
////////////////////////////َ ADMIN //////////////////////////////////////////////

export const haramAdminVectorTileConfig = [
  {
    id: 'areas-outline',
    titleFa: 'محدوده‌ها',
    table: 'public.fn_areas_mvt',
    sourceId: 'fn_areas_mvt',
    sourceLayer: AREAS_VECTOR_LAYER_NAME,
    tileUrlFactory: buildAreasTileUrlFactory(),
    type: 'line',
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#d1c2fa',
      'line-width': 2
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    }
  },
  {
    id: 'doors',
    titleFa: 'درب‌ها',
    table: 'public.fn_doors_mvt',
    sourceId: 'fn_doors_mvt',
    sourceLayer: DOORS_VECTOR_LAYER_NAME,
    tileUrlFactory: buildDoorsTileUrlFactory(),
    type: 'line',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#ff3b30',
      'line-width': 2
    }
  },
  {
    id: 'routing_edges_static-ground',
    titleFa: 'گراف مسیریابی',
    table: MESH_TRIANGLES_SOURCE_LAYER,
    sourceId: 'routing_edges_static',
    sourceLayer: ROUTING_EDGES_STATIC_SOURCE_LAYER,
    tileUrl: ROUTING_EDGES_STATIC_BASE,
    type: 'line',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: false,
    paint: {
      'line-color': '#ffddcc',
      'line-width': 0.15
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    }
  },
  {
    id: DOOR_ACCESS_LAYER_ID,
    titleFa: 'نقاط اتصال درب‌ها',
    table: DOORS_ACCESS_POINT_SOURCE_LAYER,
    sourceId: 'door_access_points',
    sourceLayer: DOORS_ACCESS_POINT_LAYER_NAME,
    tileUrlFactory: buildDoorAccessPointsTileUrlFactory(),
    type: 'circle',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'circle-color': '#ff0000',
      'circle-radius': 5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5
    }
  }
];

export const layerEditSettings = {
  'areas-outline': {
    enabled: true,
    highlightColor: '#0f172a',
    requiredPermission: 'map:edit:areas'
  },
  doors: {
    enabled: false,
    highlightColor: '#f43f5e',
    requiredPermission: 'map:edit:doors'
  },
  'routing_edges_static-ground': {
    enabled: false,
    highlightColor: '#0ea5e9',
    requiredPermission: 'map:edit:routing'
  },
  [DOOR_ACCESS_LAYER_ID]: {
    enabled: true,
    highlightColor: '#f97316',
    requiredPermission: 'map:edit:doors'
  }
};

export default haramVectorTileConfig;
