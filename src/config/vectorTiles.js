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

const TEMP_AREAS_FUNCTION_SOURCE_LAYER = 'public.fn_temp_block_areas_live_mvt';
const TEMP_AREAS_VECTOR_LAYER_NAME = 'temp_block_areas_live';
const TEMP_AREAS_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${TEMP_AREAS_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;

const DOORS_FUNCTION_SOURCE_LAYER = 'public.fn_doors_mvt';
const DOORS_VECTOR_LAYER_NAME = 'doors';
const DOORS_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${DOORS_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;

const VAN_NODES_FUNCTION_SOURCE_LAYER = 'public.fn_van_nodes_mvt';
const VAN_NODES_VECTOR_LAYER_NAME = 'van_nodes';
const VAN_NODES_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${VAN_NODES_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;

const VAN_EDGES_FUNCTION_SOURCE_LAYER = 'public.fn_van_edges_mvt';
const VAN_EDGES_VECTOR_LAYER_NAME = 'van_edges';
const VAN_EDGES_FUNCTION_TILE_BASE = `${TILE_BASE_URL}/${VAN_EDGES_FUNCTION_SOURCE_LAYER}/{z}/{x}/{y}.pbf`;

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

const buildVanNodesTileUrlFactory = () => buildFloorOnlyTileUrlFactory(VAN_NODES_FUNCTION_TILE_BASE);
const buildVanEdgesTileUrlFactory = () => buildFloorOnlyTileUrlFactory(VAN_EDGES_FUNCTION_TILE_BASE);

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

const buildTempAreasTileUrlFactory = () => ({ floor } = {}) => {
  const params = new URLSearchParams();

  if (DEFAULT_TILE_LANG) {
    params.set('p_lang', DEFAULT_TILE_LANG);
  }

  const fallbackFloor = typeof floor !== 'undefined' ? floor : DEFAULT_TILE_FLOOR;
  params.set('p_floor', normalizeFloorValue(fallbackFloor));

  // if (DEFAULT_TILE_GENDER) {
  //   params.set('p_gender', DEFAULT_TILE_GENDER);
  // }

  return `${TEMP_AREAS_FUNCTION_TILE_BASE}?${params.toString()}`;
};

const buildIconDataUri = (fillColor, label) => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <defs>
      <filter id="shadow" x="-15%" y="-15%" width="130%" height="130%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.25)" />
      </filter>
    </defs>
    <circle cx="48" cy="48" r="42" fill="${fillColor}" filter="url(#shadow)" />
    <text x="48" y="57" text-anchor="middle" font-family="Arial" font-size="40" font-weight="700" fill="#ffffff">${label}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const DOOR_ICON_IMAGES = {
  entrance: {
    name: 'door-icon-entrance',
    url: buildIconDataUri('#0ea5e9', 'E')
  },
  exit: {
    name: 'door-icon-exit',
    url: buildIconDataUri('#f97316', 'X')
  },
  emergency: {
    name: 'door-icon-emergency',
    url: buildIconDataUri('#ef4444', '!')
  },
  default: {
    name: 'door-icon-default',
    url: buildIconDataUri('#475569', 'D')
  }
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
    id: 'areas-label',
    titleFa: 'برچسب محدوده‌ها',
    table: 'public.fn_areas_mvt',          // همون
    sourceId: 'fn_areas_mvt',              // همون
    sourceLayer: AREAS_VECTOR_LAYER_NAME,  // همون
    tileUrlFactory: buildAreasTileUrlFactory(),
    type: 'symbol',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    layout: {
      // اسم فیلدی که از MVT میاد را اینجا بگذار
      'text-field': ['coalesce', ['get', 'label'], ['get', 'name'], ''],
      'text-size': 12,
      'text-anchor': 'center',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      // فونت‌ها (باید داخل glyphs استایل شما موجود باشند)
      'text-font': ['Vazirmatn Regular'],

      // کمک به خوانایی RTL
      'text-justify': 'right',
      // اگر فونت RTL داری:
      // برای راست‌به‌چپ معمولاً کمک می‌کند:
      'text-writing-mode': ['horizontal']
    },
    paint: {
      'text-color': '#111',
      'text-halo-color': '#fff',
      'text-halo-width': 2
    }
  },
  {
    id: 'doorsAccessPoint',
    titleFa: 'نقاط اتصال درب‌ها',
    table: DOORS_ACCESS_POINT_SOURCE_LAYER,
    sourceId: 'fn_door_access_points_mvt',
    sourceLayer: DOORS_ACCESS_POINT_SOURCE_LAYER,
    tileUrlFactory: buildDoorAccessPointsTileUrlFactory(),
    type: 'circle',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'circle-color': '#ff7f50',
      'circle-radius': 50,
      'circle-stroke-color': '#ffffff',
      // 'circle-stroke-width': 1.5
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
    id: 'areas-label',
    titleFa: 'برچسب محدوده‌ها',
    table: 'public.fn_areas_mvt',          // همون
    sourceId: 'fn_areas_mvt',              // همون
    sourceLayer: AREAS_VECTOR_LAYER_NAME,  // همون
    tileUrlFactory: buildAreasTileUrlFactory(),
    type: 'symbol',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    layout: {
      // اسم فیلدی که از MVT میاد را اینجا بگذار
      'text-field': ['coalesce', ['get', 'label'], ['get', 'name'], ''],
      'text-size': 12,
      'text-anchor': 'center',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      // فونت‌ها (باید داخل glyphs استایل شما موجود باشند)
      'text-font': ['Vazirmatn Regular'],

      // کمک به خوانایی RTL
      'text-justify': 'right',
      // اگر فونت RTL داری:
      // برای راست‌به‌چپ معمولاً کمک می‌کند:
      'text-writing-mode': ['horizontal']
    },
    paint: {
      'text-color': '#111',
      'text-halo-color': '#fff',
      'text-halo-width': 2
    }
  },
  {
    id: 'temp-areas-outline',
    titleFa: 'محدوده‌ موقت',
    table: 'public.fn_temp_block_areas_live_mvt',
    sourceId: 'fn_temp_block_areas_live_mvt',
    sourceLayer: TEMP_AREAS_VECTOR_LAYER_NAME,
    tileUrlFactory: buildTempAreasTileUrlFactory(),
    type: 'line',
    minzoom: 14,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#d3516f',
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
    id: 'doors-icons',
    titleFa: 'آیکون درب‌ها',
    table: 'public.fn_doors_mvt',
    sourceId: 'fn_doors_mvt',
    sourceLayer: DOORS_VECTOR_LAYER_NAME,
    tileUrlFactory: buildDoorsTileUrlFactory(),
    type: 'symbol',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    images: Object.values(DOOR_ICON_IMAGES),
    layout: {
      'icon-image': [
        'match',
        ['get', 'place_function'],
        'entrance', DOOR_ICON_IMAGES.entrance.name,
        'exit', DOOR_ICON_IMAGES.exit.name,
        'emergency', DOOR_ICON_IMAGES.emergency.name,
        /* default */ DOOR_ICON_IMAGES.default.name
      ],
      'icon-size': 0.65,
      'icon-allow-overlap': true,
      'symbol-placement': 'line-center'
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
      'line-width': 0.55
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    }
  },
  {
    id: 'van-edges',
    titleFa: 'مسیر ون برقی',
    table: MESH_TRIANGLES_SOURCE_LAYER,
    sourceId: 'van_edges',
    sourceLayer: VAN_EDGES_VECTOR_LAYER_NAME,
    tileUrlFactory: buildVanEdgesTileUrlFactory(),
    type: 'line',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'line-color': '#ffddcc',
      'line-width': 2
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    }
  },
  {
    id: 'van-nodes',
    titleFa: 'گره مسیر ون',
    table: VAN_EDGES_FUNCTION_SOURCE_LAYER,
    sourceId: 'van_nodes',
    sourceLayer: VAN_NODES_VECTOR_LAYER_NAME,
    tileUrlFactory: buildVanNodesTileUrlFactory(),
    type: 'circle',
    minzoom: 15,
    maxzoom: 22,
    visibleByDefault: true,
    paint: {
      'circle-color': '#190fff',
      'circle-radius': 5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5
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
  'temp-areas-outline': {
    enabled: true,
    highlightColor: '#0f172a',
    requiredPermission: 'map:edit:areas'
  },
  'van-nodes': {
    enabled: true,
    highlightColor: '#0f172a',
    requiredPermission: 'map:edit:van-nodes'
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
