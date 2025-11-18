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

const buildTableTileUrl = (tableName) => `${TILE_BASE_URL}/public.${tableName}/{z}/{x}/{y}.pbf`;

const TABLE_TILE_URLS = {
  areas: buildTableTileUrl('areas'),
  doors: buildTableTileUrl('doors'),
  poiPoints: buildTableTileUrl('poi_points')
};

export const haramVectorTileConfig = [
  {
    id: 'areas-outline',
    titleFa: 'مرز محدوده‌ها',
    table: 'public.areas',
    sourceId: 'areas',
    sourceLayer: 'areas',
    tileUrl: TABLE_TILE_URLS.areas,
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
    sourceLayer: 'doors',
    tileUrl: TABLE_TILE_URLS.doors,
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
