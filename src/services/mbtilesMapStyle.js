import appConfig from '../config/appConfig';

export const MBTILES_SATELLITE_SOURCE_ID = 'mbtiles-satellite';
export const MBTILES_OFFLINE_OSMH_SOURCE_ID = 'mbtiles-offline-osmh';

export const MBTILES_SATELLITE_STYLE = {
  version: 8,
  name: 'mbtiles-satellite',
  sources: {
    [MBTILES_SATELLITE_SOURCE_ID]: {
      type: 'raster',
      tiles: [appConfig.mbtilesSatelliteTilesUrl],
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

export const MBTILES_OFFLINE_OSMH_STYLE = {
  version: 8,
  name: 'mbtiles-offline-osmh',
  sources: {
    [MBTILES_OFFLINE_OSMH_SOURCE_ID]: {
      type: 'raster',
      tiles: [appConfig.mbtilesOfflineOsmhTilesUrl],
      tileSize: 256,
      minzoom: 9,
      maxzoom: 19,
      bounds: [59.0625, 36.0313317763319, 59.765625, 36.5978891330702],
      scheme: 'xyz',
      attribution: 'offline map maker tiles by allmapsoft.com'
    }
  },
  layers: [
    {
      id: MBTILES_OFFLINE_OSMH_SOURCE_ID,
      type: 'raster',
      source: MBTILES_OFFLINE_OSMH_SOURCE_ID,
      minzoom: 9,
      maxzoom: 19
    }
  ],
  metadata: {
    description: 'Offline OSMH raster tiles served from mbtileserver.'
  }
};
