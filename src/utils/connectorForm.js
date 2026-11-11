export const CONNECTOR_KINDS = ['elevator', 'stair', 'ramp', 'escalator'];
export const SAME_FLOOR_STAIR_KIND = 'same_floor_stair';
// A regular 'connection' is single-floor; an existing shared 'connection' keeps all floor stops.
export const usesSharedConnectorEditor = (kind, connectorId) =>
  kind === SAME_FLOOR_STAIR_KIND || CONNECTOR_KINDS.includes(kind) ||
  (kind === 'connection' && connectorId !== null && connectorId !== undefined && connectorId !== '');
export const emptyConnector = () => ({ id: null, direction: 'both', wait_seconds: 30, stops: [] });
export const floorLabel = (floor) => Number(floor) === 0 ? 'همکف' : Number(floor) === -1 ? 'منفی ۱' : `طبقه ${floor}`;
export const floorValue = (label) => label === 'همکف' ? 0 : label === 'منفی ۱' ? -1 : Number(String(label).replace('طبقه ', ''));
export const newStop = (floor, kind = 'elevator') => ({ floor: Number(floor), resolving: false, travel_seconds: kind === 'elevator' ? 8 : 30, reverse_seconds: null });

// The point used to open the form stays fixed, even when stop order changes.
export function isSelectedStop(stop, point, exactAccess = false) {
  if (!stop || !point?.access_id || stop.floor == null || point.floor == null || Number(stop.floor) !== Number(point.floor)) return false;
  if (!exactAccess && stop.door_id && point.door_id) return Number(stop.door_id) === Number(point.door_id);
  return Number(stop.access_id) === Number(point.access_id);
}

export function isLockedSelectedStop(stop, point, exactAccess = false) {
  return isSelectedStop(stop, point, exactAccess) && Boolean(stop.access_id) && !stop.error;
}

export function connectorAccessHits(features, floor) {
  const hits = new Map();
  for (const feature of features) {
    const { properties, geometry } = feature;
    if (geometry?.type !== 'Point' || properties?.floor == null || Number(properties.floor) !== Number(floor)) continue;
    const accessId = Number(properties.access_id || properties.id);
    if (!Number.isSafeInteger(accessId) || accessId < 1) continue;
    const [lon, lat] = geometry.coordinates;
    hits.set(accessId, { access_id: accessId, door_id: properties.door_id || null, lat, lon });
  }
  return [...hits.values()];
}

export function stairAreaCandidateParams(stops) {
  if (stops.length !== 2 || stops.some(stop => stop.floor == null || stop.resolving || stop.error || stop.accessOptions?.length)) return null;
  const [lower, upper] = stops;
  const floor = Number(lower.floor);
  const start_access_id = Number(lower.access_id);
  const end_access_id = Number(upper.access_id);
  const start_area_id = Number(lower.area_id);
  const end_area_id = Number(upper.area_id);
  if (!Number.isSafeInteger(floor) || floor !== Number(upper.floor) || start_access_id === end_access_id
      || [start_access_id, end_access_id, start_area_id, end_area_id].some(id => !Number.isSafeInteger(id) || id < 1)) return null;
  return { floor, start_access_id, end_access_id, start_area_id, end_area_id };
}

const optionalSeconds = value => value == null || value === '' ? null : Number(value);

export function connectorError(connector, kind, modes, stairCandidates) {
  const sameFloor = kind === SAME_FLOOR_STAIR_KIND;
  const floors = new Set(connector.stops.map(s => Number(s.floor)));
  if (sameFloor) {
    if (modes.length !== 1 || modes[0] !== 'walk') return 'پلهٔ داخل طبقه فقط برای تردد پیاده قابل استفاده است.';
    if (connector.stops.length !== 2 || floors.size !== 1) return 'دو سر پله را در همین طبقه مشخص کنید.';
  } else {
    if (modes.includes('van')) return 'اتصال بین طبقات برای زائربر قابل استفاده نیست.';
    if (connector.stops.length < 2) return 'حداقل دو توقف در طبقات متفاوت مشخص کنید.';
    if (floors.size !== connector.stops.length) return 'هر طبقه فقط یک توقف در این اتصال دارد.';
  }
  if (connector.stops.some(s => s.accessOptions?.length)) return 'یکی از ورودی‌های نمایش‌داده‌شده را انتخاب کنید.';
  if (connector.stops.some(s => !Number.isSafeInteger(Number(s.access_id)) || Number(s.access_id) < 1)) return 'برای هر توقف، یک نقطهٔ دسترسی موجود روی نقشه انتخاب کنید.';
  if (sameFloor && Number(connector.stops[0].access_id) === Number(connector.stops[1].access_id)) return 'برای دو سر پله دو نقطهٔ دسترسی متفاوت انتخاب کنید.';
  if (connector.stops.some(s => s.resolving || s.error || !s.area_id)) return 'فضای دسترسی همهٔ توقف‌ها باید مشخص باشد.';
  if (sameFloor && (!Number.isSafeInteger(Number(connector.stair_area_id)) || Number(connector.stair_area_id) < 1)) {
    return stairCandidates?.message || 'محدودهٔ سازگار با دو سر پله را انتخاب کنید.';
  }
  if (connector.stops.some(stop => {
    const travel = sameFloor ? optionalSeconds(stop.travel_seconds) : Number(stop.travel_seconds);
    const reverse = sameFloor ? optionalSeconds(stop.reverse_seconds) : stop.reverse_seconds;
    return (travel !== null && !(travel > 0)) || (reverse != null && !(Number(reverse) > 0));
  })) return 'زمان عبور باید بیشتر از صفر باشد.';
  if (['stair', 'escalator'].includes(kind) && modes.includes('wheelchair')) return 'پله و پله‌برقی برای ویلچر قابل استفاده نیستند.';
  if (kind === 'escalator' && connector.direction === 'both') return 'جهت حرکت پله‌برقی را مشخص کنید.';
  return '';
}

export function connectorPayload(connector, kind, info) {
  const sameFloor = kind === SAME_FLOOR_STAIR_KIND;
  return {
    kind, version: connector.version, direction: connector.direction,
    ...(sameFloor
      ? { stair_area_id: Number(connector.stair_area_id) }
      : { wait_seconds: Number(connector.wait_seconds) }),
    info,
    stops: connector.stops.map(s => ({
      floor: Number(s.floor), access_id: Number(s.access_id),
      area_id: Number(s.area_id), travel_seconds: sameFloor ? optionalSeconds(s.travel_seconds) : Number(s.travel_seconds),
      reverse_seconds: sameFloor ? optionalSeconds(s.reverse_seconds) : s.reverse_seconds == null ? null : Number(s.reverse_seconds)
    }))
  };
}
