import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import appConfig from '../config/appConfig.js';
import { adminAreaFillPaint, adminAreaOutlinePaint } from '../utils/adminAreaAppearance.js';
import { floorMessages, normalizeFloor } from '../utils/floors.js';

const SOURCE_ID = 'engineering-areas';
const TILE_FUNCTION = 'public.fn_public_engineering_map_mvt';
const mapLoadErrors = {
  fa: 'بارگذاری نقشهٔ مهندسی ناموفق بود.',
  en: 'Could not load the engineering map.',
  ar: 'تعذّر تحميل الخريطة الهندسية.',
  ur: 'انجینئرنگ کا نقشہ لوڈ نہیں ہو سکا۔'
};
const areaLayer = {
  source: SOURCE_ID,
  'source-layer': 'engineering_areas'
};

const appearance = {
  areaPublic: ['==', ['get', 'appearance_class'], 'public'],
  isClosed: ['==', ['get', 'appearance_class'], 'closed'],
  areaCovered: ['get', 'is_covered']
};

export const createEngineeringMapStyle = (language, floor = -1) => {
  const params = new URLSearchParams({ p_floor: String(normalizeFloor(floor)), p_lang: language });
  const tile = `${appConfig.tileBaseUrl}/${TILE_FUNCTION}/{z}/{x}/{y}.pbf?${params}`;
  return {
    version: 8,
    name: 'engineering-map',
    glyphs: `${appConfig.apiBaseUrl}/fonts/{fontstack}/{range}.pbf`,
    sources: {
      [SOURCE_ID]: { type: 'vector', tiles: [tile], minzoom: 10, maxzoom: 22 }
    },
    layers: [
      { id: 'engineering-background', type: 'background', paint: { 'background-color': '#fbf8f3' } },
      { ...areaLayer, id: 'engineering-area-fill', type: 'fill', minzoom: 12, paint: adminAreaFillPaint(appearance) },
      {
        ...areaLayer,
        id: 'engineering-area-outline',
        type: 'line',
        minzoom: 10,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: adminAreaOutlinePaint(appearance)
      },
      {
        ...areaLayer,
        id: 'engineering-area-label',
        type: 'symbol',
        minzoom: 16,
        layout: {
          'text-field': ['coalesce', ['get', 'label'], ''],
          'text-font': ['Vazirmatn Regular'],
          'text-size': 12
        },
        paint: { 'text-color': '#111', 'text-halo-color': '#fff', 'text-halo-width': 2 }
      }
    ]
  };
};

export default function usePublicFloorMap(
  floor, language, regularStyle, regularKey, onRegularMapError,
  selectedMapType = typeof window === 'undefined' ? null : window.sessionStorage.getItem('selectedMapType')
) {
  const normalizedFloor = normalizeFloor(floor);
  const isBasementMap = normalizedFloor === -1;
  const isEngineeringMap = isBasementMap || (selectedMapType === 'base' && normalizedFloor !== null);
  const style = useMemo(
    () => isEngineeringMap ? createEngineeringMapStyle(language, normalizedFloor) : null,
    [isEngineeringMap, language, normalizedFloor]
  );
  const mapId = useId();
  const activeNotice = useRef(null);
  const noticeCount = useRef(0);
  useEffect(() => {
    if (!isEngineeringMap) return undefined;
    return () => {
      const toastId = activeNotice.current;
      activeNotice.current = null;
      if (toastId !== null) toast.dismiss(toastId);
    };
  }, [isEngineeringMap, language, normalizedFloor]);

  const handleEngineeringError = useCallback((event) => {
    const resource = event.error?.url ?? event.error?.resource?.url;
    const isTileError = typeof resource === 'string'
      ? resource.includes(`/${TILE_FUNCTION}/`)
      : event.sourceId === SOURCE_ID && !/\/fonts\/|glyph/i.test(event.error?.message ?? '');
    if (!isTileError || activeNotice.current !== null) return;

    const source = event.target?.getSource?.(SOURCE_ID);
    if (!source?.setTiles) return;

    const toastId = `${mapId}-engineering-${++noticeCount.current}`;
    activeNotice.current = toastId;
    const text = floorMessages[language] ?? floorMessages.fa;
    toast.warn(({ closeToast }) => (
      <div>
        <div>{mapLoadErrors[language] ?? mapLoadErrors.fa}</div>
        <button type="button" onClick={() => {
          activeNotice.current = null;
          closeToast();
          source.setTiles(style.sources[SOURCE_ID].tiles);
        }}>{text.retry}</button>
      </div>
    ), {
      toastId,
      autoClose: false,
      closeOnClick: false,
      onClose: () => {
        if (activeNotice.current === toastId) activeNotice.current = null;
      }
    });
  }, [language, mapId, style]);

  return {
    mapStyle: style ?? regularStyle,
    mapRenderKey: isEngineeringMap ? `engineering-map-${normalizedFloor}-${language}` : regularKey,
    isEngineeringMap,
    isBasementMap,
    onMapError: isEngineeringMap ? handleEngineeringError : onRegularMapError
  };
}
