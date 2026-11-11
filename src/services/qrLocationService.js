import appConfig from '../config/appConfig.js';
import { getPointFloor, normalizeFloor } from '../utils/floors.js';
import { setSessionFloor } from '../utils/sessionFloor.js';
import { isFresh } from '../utils/locationQuality.js';

const pending = new Map();
const qrFetchOptions = { cache: 'no-store', priority: 'high' };
const scanLookupTimeoutMs = 12000;
const scanLookupAttempts = 2;
const validCoordinates = (lat, lng) => lat !== null && lng !== null && String(lat).trim() !== '' && String(lng).trim() !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
const qrKey = () => ['qrLat', 'qrLng', 'qrId'].map(key => sessionStorage.getItem(key) || '').join('|');

function fetchQrLocation(code, query, signal) {
  return fetch(`${appConfig.apiBaseUrl}/api/v1/qrcodes/${encodeURIComponent(code)}?${query}`, {
    ...qrFetchOptions, signal, headers: { Accept: 'application/json' }
  });
}

async function lookupScannedQrRecord(code, language, signal) {
  const query = new URLSearchParams({ language, includeContents: 'false', includeComments: 'false' });
  for (let attempt = 1; attempt <= scanLookupAttempts; attempt += 1) {
    if (signal?.aborted) throw signal.reason;
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), scanLookupTimeoutMs);
    try {
      const response = await fetchQrLocation(code, query, controller.signal);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`QR lookup failed (${response.status})`);
      // A response can stall after the headers. Keep the deadline through the body read.
      return await response.json();
    } catch (error) {
      const retryable = controller.signal.aborted || error instanceof TypeError;
      if (!retryable || signal?.aborted || attempt === scanLookupAttempts) throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
}

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

  const record = await lookupScannedQrRecord(code, language, signal);
  if (!record) return null;
  const { id, coordinates, floor, title } = record;
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

async function lookupLinkedQrRecord(id, language, signal) {
  const response = await fetchQrLocation(id, new URLSearchParams({ language }), signal);
  if (response.ok) {
    const data = await response.json();
    return data.id === id ? data : null;
  }
  // Explicit legacy POI identifiers only; a disabled QR ending in digits must not fall through.
  const legacy = id.match(/^(?:poi_)?(\d+)$/i);
  if (response.status !== 404 || !legacy) return null;
  const places = await fetch(`${appConfig.landmarkPlacesUrl}?language=${encodeURIComponent(language)}&poi_id=${legacy[1]}&limit=1`,
    { ...qrFetchOptions, signal });
  if (!places.ok) return null;
  const data = await places.json();
  const place = data?.places?.landmarkPlaces?.find(item => String(item.id) === legacy[1]);
  return place ? { ...place, coordinates: place.coordinates ?? [place.geo?.lat, place.geo?.lon ?? place.geo?.lng] } : null;
}

function applyLinkedQrRecord(record, previousPoint) {
  const [lat, lng] = Array.isArray(record?.coordinates) ? record.coordinates : [];
  if (!validCoordinates(lat ?? null, lng ?? null)) return null;
  const floor = getPointFloor(record);
  sessionStorage.setItem('qrLat', String(lat));
  sessionStorage.setItem('qrLng', String(lng));
  if (typeof record.title === 'string') sessionStorage.setItem('qrName', record.title);
  if (floor !== null) {
    sessionStorage.setItem('qrFloor', String(floor));
    setSessionFloor(floor);
  } else {
    // Only an explicit floor selection made during the lookup may survive an unknown server floor.
    if (sessionStorage.getItem('qrFloor') === String(previousPoint?.floor)) sessionStorage.removeItem('qrFloor');
  }
  sessionStorage.setItem('qrVerified', qrKey());
  sessionStorage.setItem('qrFloorApplied', qrKey());
  return readQrPoint();
}

export async function acceptLinkedQrPoint(id, language, signal) {
  if (!/^[a-z0-9_-]{1,120}$/i.test(id)) return null;
  const record = await lookupLinkedQrRecord(id, language, signal);
  const [lat, lng] = Array.isArray(record?.coordinates) ? record.coordinates : [];
  if (signal.aborted || !validCoordinates(lat ?? null, lng ?? null)) return null;
  clearQrLocation();
  sessionStorage.setItem('qrId', id);
  sessionStorage.setItem('qrCapturedAt', String(Date.now()));
  return applyLinkedQrRecord(record);
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
      record = await lookupLinkedQrRecord(id, language, controller.signal);
    } catch { /* A failed lookup cannot turn URL coordinates into a trusted anchor. */ }
    finally { clearTimeout(timer); }
    if (key !== qrKey()) return null;
    const resolved = applyLinkedQrRecord(record, point);
    if (!resolved) clearQrLocation();
    return resolved;
  })();
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}
