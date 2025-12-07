// import { MAPLIBRE_GLYPHS_URL } from '../utils/mapLibreConfig';

export const BASE_RASTER_SOURCE_ID = 'carto-voyager-base';

export const CARTO_VOYAGER_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

export const offlineFallbackStyle = {
  version: 8,
  name: 'offline-fallback',
  // glyphs: MAPLIBRE_GLYPHS_URL,
  sources: {},
  layers: [
    {
      id: 'offline-background',
      type: 'background',
      paint: {
        'background-color': '#0b192f'
      }
    }
  ],
  metadata: {
    description: 'Fallback style used when map tiles cannot be loaded'
  }
};

const voyagerBaseMapStyle = CARTO_VOYAGER_STYLE_URL;

export default voyagerBaseMapStyle;
