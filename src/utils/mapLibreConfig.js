import maplibregl from 'maplibre-gl';

export const MAPLIBRE_GLYPHS_URL =
  (import.meta?.env?.VITE_MAPLIBRE_GLYPHS_URL?.trim() || '/fonts/{fontstack}/{range}.pbf')
    .replace(/\/$/, '');

export const MAPLIBRE_RTL_PLUGIN_URL =
  (import.meta?.env?.VITE_MAPLIBRE_RTL_PLUGIN_URL?.trim()
    || 'https://unpkg.com/@maplibre/maplibre-gl-rtl-text@latest/dist/maplibre-gl-rtl-text.js')
    .replace(/\/$/, '');

const RTL_PLUGIN_ERROR_MESSAGE = 'Failed to initialize MapLibre RTL text plugin';
let rtlPluginInitialized = false;

const initializeRTLTextPlugin = () => {
  if (rtlPluginInitialized || typeof maplibregl?.setRTLTextPlugin !== 'function') {
    return;
  }

  try {
    maplibregl.setRTLTextPlugin(
      MAPLIBRE_RTL_PLUGIN_URL,
      (error) => {
        if (error) {
          console.error(RTL_PLUGIN_ERROR_MESSAGE, error);
        }
      },
      true
    );
    rtlPluginInitialized = true;
  } catch (error) {
    console.error(RTL_PLUGIN_ERROR_MESSAGE, error);
  }
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
