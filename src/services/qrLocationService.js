import appConfig from '../config/appConfig.js';
import { getPointFloor, normalizeFloor } from '../utils/floors.js';
import { setSessionFloor } from '../utils/sessionFloor.js';
import { isFresh } from '../utils/locationQuality.js';
import { userRequest } from '../api/userRequest.js';

const pending = new Map();
const validCoordinates = (lat, lng) => lat !== null && lng !== null && String(lat).trim() !== '' && String(lng).trim() !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
const qrKey = () => ['qrLat', 'qrLng', 'qrId'].map(key => sessionStorage.getItem(key) || '').join('|');

export async function resolveScannedQrPoint(value, language, signal) {
  let code = typeof value === 'string' ? value.trim() : '';
  const codePattern = /^[a-z0-9_-]{1,120}$/i;
  if (!codePattern.test(code)) {
    let url;
    try { url = new URL(code); } catch { return null; }
    const [page, query] = url.hash.slice(1).split('?');
    const locationLink = page === '/location' || (!page && url.pathname === '/location');
    if (!['https:', 'http:'].includes(url.protocol) || !locationLink) return null;
    code = new URLSearchParams(query ?? url.search).get('id') || '';
  }
  if (!codePattern.test(code)) return null;

  const query = new URLSearchParams({ language, includeContents: 'false', includeComments: 'false' });
  const response = await userRequest(`${appConfig.apiBaseUrl}/api/v1/qrcodes/${encodeURIComponent(code)}?${query}`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`QR lookup failed (${response.status})`);

  const { id, coordinates, floor, title } = await response.json();
  const [lat, lng] = Array.isArray(coordinates) ? coordinates : [];
  if (id !== code || !validCoordinates(lat ?? null, lng ?? null)) return null;
  return { coordinates: [Number(lat), Number(lng)], floor: normalizeFloor(floor), name: title || code, source: 'qr', qrCode: code, verified: true, timestamp: Date.now(), accuracy: 2 };
}

export function clearQrLocation() {
  for (const key of ['qrLat', 'qrLng', 'qrId', 'qrFloor', 'qrName', 'qrFloorApplied', 'qrVerified', 'qrCapturedAt']) {
    sessionStorage.removeItem(key);
  }
}

export function readQrPoint() {
  const lat = sessionStorage.getItem('qrLat');
  const lng = sessionStorage.getItem('qrLng');
  if (!validCoordinates(lat, lng)) return null;
  const verified = sessionStorage.getItem('qrVerified') === qrKey();
  const capturedAt = sessionStorage.getItem('qrCapturedAt');
  return { coordinates: [Number(lat), Number(lng)], floor: normalizeFloor(sessionStorage.getItem('qrFloor')),
    source: 'qr', qrCode: sessionStorage.getItem('qrId'), verified,
    timestamp: verified && capturedAt ? Number(capturedAt) : null, accuracy: verified ? 2 : null };
}

export function captureQrLocation(params) {
  if (!params.has('lat') && !params.has('lng') && !params.has('id')) return;
  clearQrLocation();
  const lat = params.get('lat');
  const lng = params.get('lng');
  const id = params.get('id');
  if (id && !/^[a-z0-9_-]{1,120}$/i.test(id)) return;
  if (id) sessionStorage.setItem('qrId', id);
  if (validCoordinates(lat, lng)) {
    sessionStorage.setItem('qrLat', lat);
    sessionStorage.setItem('qrLng', lng);
  }
  if (!id && !validCoordinates(lat, lng)) return;
  sessionStorage.setItem('qrCapturedAt', String(Date.now()));
  const floor = normalizeFloor(params.get('floor'));
  if (floor !== null) sessionStorage.setItem('qrFloor', String(floor));
}

export async function resolveQrPoint(language = 'fa') {
  const point = readQrPoint();
  const id = sessionStorage.getItem('qrId');
  if (!id) return point; // Coordinate-only links remain unverified manual origins.
  if (point?.verified && isFresh(point.timestamp)) return point;
  const key = qrKey();
  if (pending.has(key)) return pending.get(key);
  const promise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let record = null;
    try {
      const response = await fetch(`${appConfig.apiBaseUrl}/api/v1/qrcodes/${encodeURIComponent(id)}?language=${encodeURIComponent(language)}`,
        { signal: controller.signal, cache: 'no-store', headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        if (data.id === id) record = data;
      }
      // Explicit legacy POI identifiers only; a disabled QR ending in digits must not fall through.
      const legacy = id.match(/^(?:poi_)?(\d+)$/i);
      if (response.status === 404 && legacy) {
        const response = await fetch(`${appConfig.landmarkPlacesUrl}?language=${encodeURIComponent(language)}&poiId=${legacy[1]}&limit=1`,
          { signal: controller.signal, cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          const place = data?.places?.landmarkPlaces?.find(item => String(item.id) === legacy[1]);
          if (place) record = { ...place, coordinates: place.coordinates ?? [place.geo?.lat, place.geo?.lon ?? place.geo?.lng] };
        }
      }
    } catch { /* A failed lookup cannot turn URL coordinates into a trusted anchor. */ }
    finally { clearTimeout(timer); }
    if (key !== qrKey()) return null;
    const [lat, lng] = record?.coordinates || [];
    if (!validCoordinates(lat ?? null, lng ?? null)) {
      clearQrLocation();
      return null;
    }
    const floor = getPointFloor(record);
    sessionStorage.setItem('qrLat', String(lat));
    sessionStorage.setItem('qrLng', String(lng));
    if (typeof record.title === 'string') sessionStorage.setItem('qrName', record.title);
    if (floor !== null) {
      sessionStorage.setItem('qrFloor', String(floor));
      setSessionFloor(floor);
    } else {
      // Only an explicit floor selection made during this lookup may survive an unknown server floor.
      if (sessionStorage.getItem('qrFloor') === String(point?.floor)) sessionStorage.removeItem('qrFloor');
    }
    sessionStorage.setItem('qrVerified', qrKey());
    sessionStorage.setItem('qrFloorApplied', qrKey());
    return readQrPoint();
  })();
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}
