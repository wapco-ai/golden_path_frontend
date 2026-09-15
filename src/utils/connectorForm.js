export const CONNECTOR_KINDS = ['elevator', 'stair', 'ramp', 'escalator'];
export const emptyConnector = () => ({ id: null, direction: 'both', wait_seconds: 30, stops: [] });
export const floorLabel = (floor) => Number(floor) === 0 ? 'همکف' : Number(floor) === -1 ? 'منفی ۱' : `طبقه ${floor}`;
export const floorValue = (label) => label === 'همکف' ? 0 : label === 'منفی ۱' ? -1 : Number(String(label).replace('طبقه ', ''));
export const newStop = (floor, kind = 'elevator') => ({ floor: Number(floor), resolving: false, travel_seconds: kind === 'elevator' ? 8 : 30, reverse_seconds: null });

export function connectorError(connector, kind, modes) {
  if (modes.includes('van')) return 'اتصال بین طبقات برای ون برقی قابل استفاده نیست.';
  if (connector.stops.length < 2) return 'حداقل دو توقف در طبقات متفاوت مشخص کنید.';
  if (new Set(connector.stops.map(s => Number(s.floor))).size !== connector.stops.length) return 'هر طبقه فقط یک توقف در این اتصال دارد.';
  if (connector.stops.some(s => !s.access_id && (s.lat == null || s.lon == null))) return 'نقطهٔ همهٔ توقف‌ها را روی نقشه مشخص کنید.';
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
      floor: Number(s.floor), ...(s.access_id ? { access_id: Number(s.access_id) } : { lat: s.lat, lon: s.lon }),
      area_id: Number(s.area_id), travel_seconds: Number(s.travel_seconds),
      reverse_seconds: s.reverse_seconds == null ? null : Number(s.reverse_seconds)
    }))
  };
}
