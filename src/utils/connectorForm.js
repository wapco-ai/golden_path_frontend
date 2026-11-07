export const CONNECTOR_KINDS = ['elevator', 'stair', 'ramp', 'escalator'];
// A regular 'connection' is single-floor; an existing shared 'connection' keeps all floor stops.
export const usesSharedConnectorEditor = (kind, connectorId) =>
  CONNECTOR_KINDS.includes(kind) ||
  (kind === 'connection' && connectorId !== null && connectorId !== undefined && connectorId !== '');
export const emptyConnector = () => ({ id: null, direction: 'both', wait_seconds: 30, stops: [] });
export const floorLabel = (floor) => Number(floor) === 0 ? 'همکف' : Number(floor) === -1 ? 'منفی ۱' : `طبقه ${floor}`;
export const floorValue = (label) => label === 'همکف' ? 0 : label === 'منفی ۱' ? -1 : Number(String(label).replace('طبقه ', ''));
export const newStop = (floor, kind = 'elevator') => ({ floor: Number(floor), resolving: false, travel_seconds: kind === 'elevator' ? 8 : 30, reverse_seconds: null });

// The point used to open the form stays fixed, even when stop order changes.
export function isSelectedStop(stop, point) {
  if (!stop || !point?.access_id || stop.floor == null || point.floor == null || Number(stop.floor) !== Number(point.floor)) return false;
  if (stop.door_id && point.door_id) return Number(stop.door_id) === Number(point.door_id);
  return Number(stop.access_id) === Number(point.access_id);
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

export function connectorError(connector, kind, modes) {
  if (modes.includes('van')) return 'اتصال بین طبقات برای ون برقی قابل استفاده نیست.';
  if (connector.stops.length < 2) return 'حداقل دو توقف در طبقات متفاوت مشخص کنید.';
  if (new Set(connector.stops.map(s => Number(s.floor))).size !== connector.stops.length) return 'هر طبقه فقط یک توقف در این اتصال دارد.';
  if (connector.stops.some(s => s.accessOptions?.length)) return 'یکی از ورودی‌های نمایش‌داده‌شده را انتخاب کنید.';
  if (connector.stops.some(s => !Number.isSafeInteger(Number(s.access_id)) || Number(s.access_id) < 1)) return 'برای هر توقف، یک نقطهٔ دسترسی موجود روی نقشه انتخاب کنید.';
  if (connector.stops.some(s => s.resolving || s.error || !s.area_id)) return 'فضای دسترسی همهٔ توقف‌ها باید مشخص باشد.';
  if (connector.stops.some(s => !(Number(s.travel_seconds) > 0) || (s.reverse_seconds != null && !(Number(s.reverse_seconds) > 0)))) return 'زمان عبور باید بیشتر از صفر باشد.';
  if (['stair', 'escalator'].includes(kind) && modes.includes('wheelchair')) return 'پله و پله‌برقی برای ویلچر قابل استفاده نیستند.';
  if (kind === 'escalator' && connector.direction === 'both') return 'جهت حرکت پله‌برقی را مشخص کنید.';
  return '';
}

export function connectorPayload(connector, kind, info) {
  return {
    kind, version: connector.version, direction: connector.direction,
    wait_seconds: Number(connector.wait_seconds), info,
    stops: connector.stops.map(s => ({
      floor: Number(s.floor), access_id: Number(s.access_id),
      area_id: Number(s.area_id), travel_seconds: Number(s.travel_seconds),
      reverse_seconds: s.reverse_seconds == null ? null : Number(s.reverse_seconds)
    }))
  };
}
