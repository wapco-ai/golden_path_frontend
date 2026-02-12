// import { MAPLIBRE_GLYPHS_URL } from '../utils/mapLibreConfig';

export const BASE_RASTER_SOURCE_ID = 'carto-voyager-base';

export const CARTO_VOYAGER_STYLE_URL = '/map-styles/osm-streets-3d/style.json';

export const offlineFallbackStyle = {
  version: 8,
  name: 'offline-fallback',
  // glyphs: MAPLIBRE_GLYPHS_URL,
  sources: {
    [BASE_RASTER_SOURCE_ID]: {
      type: 'raster',
      tileSize: 256,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap contributors'
    }
  },
  layers: [
    {
      id: 'offline-background',
      type: 'background',
      paint: {
        'background-color': '#0b192f'
      }
    },
    {
      id: 'offline-raster',
      type: 'raster',
      source: BASE_RASTER_SOURCE_ID,
      minzoom: 0,
      maxzoom: 19
    }
  ],
  metadata: {
    description:
      'Fallback style used when Carto basemap tiles cannot be loaded; serves OSM raster tiles instead.'
  }
};

const voyagerBaseMapStyle = CARTO_VOYAGER_STYLE_URL;

export default voyagerBaseMapStyle;
