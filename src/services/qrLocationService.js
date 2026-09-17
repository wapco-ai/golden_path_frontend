import appConfig from '../config/appConfig.js';
import { fetchLandmarkPlaces } from './landmarkService.js';
import { getPointFloor, normalizeFloor } from '../utils/floors.js';
import { setSessionFloor } from '../utils/sessionFloor.js';

const pending = new Map();
const validCoordinates = (lat, lng) => lat !== null && lng !== null && String(lat).trim() !== '' && String(lng).trim() !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
const qrKey = () => ['qrLat', 'qrLng', 'qrId'].map(key => sessionStorage.getItem(key) || '').join('|');

export function readQrPoint() {
  const lat = sessionStorage.getItem('qrLat');
  const lng = sessionStorage.getItem('qrLng');
  if (!validCoordinates(lat, lng)) return null;
  return { coordinates: [Number(lat), Number(lng)], floor: normalizeFloor(sessionStorage.getItem('qrFloor')), source: 'qr' };
}

export function captureQrLocation(params) {
  const lat = params.get('lat');
  const lng = params.get('lng');
  if (!validCoordinates(lat, lng)) return;
  sessionStorage.setItem('qrLat', lat);
  sessionStorage.setItem('qrLng', lng);
  if (params.get('id')) sessionStorage.setItem('qrId', params.get('id'));
  else sessionStorage.removeItem('qrId');
  sessionStorage.removeItem('qrFloor');
  sessionStorage.removeItem('qrName');
  sessionStorage.removeItem('qrFloorApplied');
  const floor = normalizeFloor(params.get('floor'));
  if (floor !== null) {
    sessionStorage.setItem('qrFloor', String(floor));
    sessionStorage.setItem('qrFloorApplied', qrKey());
    setSessionFloor(floor);
  }
}

export async function resolveQrPoint(language = 'fa') {
  const point = readQrPoint();
  if (!point || point.floor !== null) return point;
  const key = qrKey();
  if (pending.has(key)) return pending.get(key);
  const promise = (async () => {
    const id = sessionStorage.getItem('qrId');
    let floor = null;
    if (id) {
      try {
        const response = await fetch(`${appConfig.apiBaseUrl}/api/v1/qrcodes/${encodeURIComponent(id)}?language=${language}`, { headers: { Accept: 'application/json' } });
        if (response.ok) floor = getPointFloor(await response.json());
        // Older printed links identify their associated POI rather than a QR record.
        if (response.status === 404) {
          const match = id.match(/(?:^|_)(\d+)$/);
          if (match) {
            const data = await fetchLandmarkPlaces({ language, poiId: match[1], limit: 1 });
            const place = data?.places?.landmarkPlaces?.find(item => String(item.id) === match[1]);
            floor = getPointFloor(place);
          }
        }
      } catch { /* Unknown floors are selected explicitly in the existing map flow. */ }
    }
    if (key !== qrKey()) return null;
    if (floor !== null) {
      sessionStorage.setItem('qrFloor', String(floor));
      if (sessionStorage.getItem('qrFloorApplied') !== key) {
        setSessionFloor(floor);
        sessionStorage.setItem('qrFloorApplied', key);
      }
    }
    return readQrPoint();
  })();
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}
