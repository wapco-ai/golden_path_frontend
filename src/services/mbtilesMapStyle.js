export const MBTILES_SATELLITE_SOURCE_ID = 'mbtiles-satellite';

export const MBTILES_SATELLITE_STYLE = {
  version: 8,
  name: 'mbtiles-satellite',
  sources: {
    [MBTILES_SATELLITE_SOURCE_ID]: {
      type: 'raster',
      tiles: ['http://localhost:8088/services/gsm/tiles/{z}/{x}/{y}.jpg'],
      tileSize: 256,
      minzoom: 15,
      maxzoom: 21,
      attribution: 'offline map maker tiles by allmapsoft.com'
    }
  },
  layers: [
    {
      id: 'mbtiles-satellite',
      type: 'raster',
      source: MBTILES_SATELLITE_SOURCE_ID,
      minzoom: 6,
      maxzoom: 21
    }
  ],
  metadata: {
    description: 'Offline satellite tiles served from the mbtileserver container.'
  }
};
