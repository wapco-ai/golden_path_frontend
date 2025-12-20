import maplibregl from 'maplibre-gl';

export const MAPLIBRE_RTL_PLUGIN_URL = 'https://unpkg.com/@maplibre/maplibre-gl-rtl-text@1.0.3/dist/maplibre-gl-rtl-text.js';
export const MAPLIBRE_GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

let rtlPluginInitialized = false;

export const ensureMaplibreRtlPlugin = () => {
  if (rtlPluginInitialized || typeof maplibregl?.setRTLTextPlugin !== 'function') {
    return;
  }

  try {
    maplibregl.setRTLTextPlugin(MAPLIBRE_RTL_PLUGIN_URL, undefined, true);
    rtlPluginInitialized = true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Failed to initialize MapLibre RTL text plugin', error);
  }
};
