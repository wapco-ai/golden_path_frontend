export const offlineFallbackStyle = {
  version: 8,
  name: 'offline-fallback',
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

const vectorBaseMapStyle = {
  version: 8,
  name: 'haram-vector-base',
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: [
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
      ],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: 'vector-background',
      type: 'background',
      paint: {
        'background-color': '#02101f'
      }
    },
    {
      id: 'osm-raster-base',
      type: 'raster',
      source: 'osm-raster',
      minzoom: 0,
      maxzoom: 19
    }
  ],
  metadata: {
    description: 'OpenStreetMap base style with Haram vector overlays'
  }
};

export default vectorBaseMapStyle;
