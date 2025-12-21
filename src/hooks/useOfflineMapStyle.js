import { useCallback, useEffect, useRef, useState } from 'react';
import osmMapStyle, { BASE_RASTER_SOURCE_ID, offlineFallbackStyle } from '../services/osmMapStyle';
import { toast } from 'react-toastify';

const FALLBACK_TOAST_ID = 'map-tiles-fallback-notice';

/**
 * Provides a map style that automatically falls back to an offline-friendly version
 * whenever MapLibre fails to load raster tiles (e.g., due to blocked network access).
 */
const extractSourceId = (event) => {
  if (!event) return null;

  return event.sourceId ||
    event?.error?.sourceId ||
    event?.tile?.sourceId ||
    event?.tile?.source ||
    event?.error?.source ||
    null;
};

const extractResourceUrl = (event) =>
  event?.error?.resource?.url || event?.error?.url || event?.url || null;

const BASEMAP_RESOURCE_HINTS = ['tile.openstreetmap.org', 'basemaps.cartocdn.com', 'cartocdn.com'];
const BASEMAP_SOURCE_IDS = [BASE_RASTER_SOURCE_ID, 'basemap', 'basemap_tiles', 'voyager'];

const shouldTriggerFallback = (event) => {
  const resourceUrl = extractResourceUrl(event);
  if (resourceUrl) {
    return BASEMAP_RESOURCE_HINTS.some((hint) => resourceUrl.includes(hint));
  }

  const sourceId = extractSourceId(event);
  if (sourceId) {
    return BASEMAP_SOURCE_IDS.includes(sourceId);
  }

  return true;
};

export default function useOfflineMapStyle(initialStyle = osmMapStyle) {
  const [mapStyle, setMapStyle] = useState(initialStyle);
  const [isFallback, setIsFallback] = useState(initialStyle === offlineFallbackStyle);
  const hasSwitchedRef = useRef(initialStyle === offlineFallbackStyle);

  useEffect(() => {
    setMapStyle(initialStyle);
    const initialFallback = initialStyle === offlineFallbackStyle;
    setIsFallback(initialFallback);
    hasSwitchedRef.current = initialFallback;
  }, [initialStyle]);

  const handleMapError = useCallback((event) => {
    if (hasSwitchedRef.current) {
      return;
    }

    if (!shouldTriggerFallback(event)) {
      console.warn('Map error ignored because it is unrelated to the base raster source.', event);
      return;
    }

    hasSwitchedRef.current = true;
    setMapStyle(offlineFallbackStyle);
    setIsFallback(true);

    const errorDetail = event?.error || event;
    console.warn('Map tile load failed. Switching to offline fallback style.', errorDetail);

    toast.warn('Map tiles are unavailable. Showing simplified map instead.', {
      toastId: FALLBACK_TOAST_ID
    });
  }, []);

  const styleKey = isFallback ? 'offline-style' : 'online-style';

  return {
    mapStyle,
    handleMapError,
    isFallback,
    styleKey
  };
}
