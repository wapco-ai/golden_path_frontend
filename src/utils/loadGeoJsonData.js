import { DEFAULT_TILE_FLOOR, DEFAULT_TILE_LANG, TILE_BASE_URL } from '../config/vectorTiles.js';

const DEFAULT_FLOOR = 0;
const FALLBACK_LANG = DEFAULT_TILE_LANG || 'fa';
const FALLBACK_FLOOR =
  DEFAULT_TILE_FLOOR !== undefined && DEFAULT_TILE_FLOOR !== ''
    ? Number(DEFAULT_TILE_FLOOR)
    : DEFAULT_FLOOR;

const toFloorValue = (floor) => {
  if (typeof floor === 'number' && !Number.isNaN(floor)) {
    return floor;
  }

  if (typeof floor === 'string' && floor.trim() !== '') {
    const parsed = Number(floor);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return FALLBACK_FLOOR;
};

export async function loadGeoJsonData({ language = FALLBACK_LANG, floor = FALLBACK_FLOOR, signal } = {}) {
  const params = new URLSearchParams();
  params.set('p_lang', (language || FALLBACK_LANG).trim());
  params.set('p_floor', toFloorValue(floor));

  const requestUrl = `${TILE_BASE_URL}/public.fn_map_geojson?${params.toString()}`;

  try {
    const response = await fetch(requestUrl, { signal });
    if (!response.ok) {
      throw new Error(`GeoJSON request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.error('failed to load geojson data', error);
    throw error;
  }
}

export default loadGeoJsonData;
