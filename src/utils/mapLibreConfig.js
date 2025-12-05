import maplibregl from 'maplibre-gl';

export const MAPLIBRE_GLYPHS_URL =
  (import.meta?.env?.VITE_MAPLIBRE_GLYPHS_URL?.trim() || '/fonts/{fontstack}/{range}.pbf')
    .replace(/\/$/, '');

export const DEFAULT_MAPLIBRE_RTL_PLUGIN_URL =
  'https://unpkg.com/@maplibre/maplibre-gl-rtl-text@latest/dist/maplibre-gl-rtl-text.js';

export const MAPLIBRE_RTL_PLUGIN_URL =

  (import.meta?.env?.VITE_MAPLIBRE_RTL_PLUGIN_URL?.trim() || DEFAULT_MAPLIBRE_RTL_PLUGIN_URL)
    .replace(/\/$/, '');

const RTL_PLUGIN_ERROR_MESSAGE = 'Failed to initialize MapLibre RTL text plugin';
let rtlPluginInitialized = false;

const attemptRTLTextPluginInitialization = (pluginUrl) => {
  maplibregl.setRTLTextPlugin(
    pluginUrl,
    (error) => {
      if (error) {
        console.error(`${RTL_PLUGIN_ERROR_MESSAGE} (${pluginUrl})`, error);

        if (pluginUrl !== DEFAULT_MAPLIBRE_RTL_PLUGIN_URL) {
          console.info('Falling back to default MapLibre RTL text plugin URL.');
          attemptRTLTextPluginInitialization(DEFAULT_MAPLIBRE_RTL_PLUGIN_URL);
        }
        return;
      }

      rtlPluginInitialized = true;
    },
    true
  );
};

const initializeRTLTextPlugin = () => {
  if (rtlPluginInitialized || typeof maplibregl?.setRTLTextPlugin !== 'function') {
    return;
  }

  attemptRTLTextPluginInitialization(MAPLIBRE_RTL_PLUGIN_URL);
};

initializeRTLTextPlugin();

const extractGlyphSegments = (url) => {
  const match = url.match(/\/([^/]+)\/([0-9]+-[0-9]+\.pbf)(?:\?.*)?$/);
  if (!match) return null;

  const [, fontstack, range] = match;
  try {
    const normalizedFontstack = encodeURIComponent(decodeURIComponent(fontstack));
    return { fontstack: normalizedFontstack, range };
  } catch (error) {
    console.warn('Unable to normalize glyph fontstack. Using original value.', error);
    return { fontstack, range };
  }
};

export const mapLibreTransformRequest = (url, resourceType) => {
  if (resourceType === 'Glyphs') {
    const segments = extractGlyphSegments(url);
    if (segments) {
      const mappedUrl = MAPLIBRE_GLYPHS_URL
        .replace('{fontstack}', segments.fontstack)
        .replace('{range}', segments.range);
      return { url: mappedUrl };
    }
  }

  return { url };
};

export default maplibregl;
