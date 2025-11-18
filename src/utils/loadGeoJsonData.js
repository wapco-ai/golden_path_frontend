import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import { TILE_BASE_URL, DEFAULT_TILE_FLOOR } from '../config/vectorTiles.js';

const DEFAULT_FLOOR = 0;
const FALLBACK_FLOOR =
  DEFAULT_TILE_FLOOR !== undefined && DEFAULT_TILE_FLOOR !== ''
    ? Number(DEFAULT_TILE_FLOOR)
    : DEFAULT_FLOOR;
const DEFAULT_VECTOR_TILE_ZOOM = 16;
const FEATURE_SOURCE_LAYER = 'public.fn_areas_mvt';
const HARAM_BOUNDS = {
  minLng: 59.61013495098894,
  minLat: 36.28169290965149,
  maxLng: 59.62097859479816,
  maxLat: 36.294230336530596
};

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

const lngToTileX = (lng, zoom) => {
  const normalizedLng = ((lng + 180) / 360) * 2 ** zoom;
  return Math.floor(normalizedLng);
};

const latToTileY = (lat, zoom) => {
  const latRad = (lat * Math.PI) / 180;
  const normalizedLat =
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2;
  return Math.floor(normalizedLat * 2 ** zoom);
};

const getTileRangeForBounds = (bounds, zoom) => {
  const minX = lngToTileX(bounds.minLng, zoom);
  const maxX = lngToTileX(bounds.maxLng, zoom);
  const minY = latToTileY(bounds.maxLat, zoom);
  const maxY = latToTileY(bounds.minLat, zoom);

  return { minX, maxX, minY, maxY };
};

const buildTileUrl = ({ z, x, y, floor }) => {
  const params = new URLSearchParams();

  const normalizedFloor = toFloorValue(floor);
  if (typeof normalizedFloor === 'number' && !Number.isNaN(normalizedFloor)) {
    params.set('p_floor', normalizedFloor);
  }

  const query = params.toString();
  const base = `${TILE_BASE_URL}/${FEATURE_SOURCE_LAYER}/${z}/${x}/${y}.pbf`;
  return query ? `${base}?${query}` : base;
};

const decodeTileFeatures = (arrayBuffer, layerId, tileCoords) => {
  if (!arrayBuffer) {
    return [];
  }

  const tile = new VectorTile(new Protobuf(new Uint8Array(arrayBuffer)));
  const layer = tile.layers[layerId];
  if (!layer) {
    return [];
  }

  const features = [];
  for (let i = 0; i < layer.length; i += 1) {
    const feature = layer.feature(i).toGeoJSON(tileCoords.x, tileCoords.y, tileCoords.z);
    features.push(feature);
  }
  return features;
};

export async function loadGeoJsonData({ floor = FALLBACK_FLOOR, zoom = DEFAULT_VECTOR_TILE_ZOOM, signal } = {}) {
  const tileRange = getTileRangeForBounds(HARAM_BOUNDS, zoom);
  const requests = [];

  for (let x = tileRange.minX; x <= tileRange.maxX; x += 1) {
    for (let y = tileRange.minY; y <= tileRange.maxY; y += 1) {
      const url = buildTileUrl({ z: zoom, x, y, floor });
      const request = fetch(url, { signal })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Vector tile request failed with status ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then((buffer) => decodeTileFeatures(buffer, FEATURE_SOURCE_LAYER, { z: zoom, x, y }));
      requests.push(request);
    }
  }

  try {
    const tiles = await Promise.all(requests);
    const features = tiles.flat();
    return {
      type: 'FeatureCollection',
      features
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.error('failed to load geojson data', error);
    throw error;
  }
}

export default loadGeoJsonData;
