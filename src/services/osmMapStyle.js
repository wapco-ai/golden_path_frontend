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
  sources: {},
  layers: [
    {
      id: 'vector-background',
      type: 'background',
      paint: {
        'background-color': '#02101f'
      }
    }
  ],
  metadata: {
    description: 'Empty base style for Haram vector tiles'
  }
};

export default vectorBaseMapStyle;
