import { getNavigationPolicy } from '../services/navigationPolicy.js';
export const GPS_MAX_ACCURACY = 25;
export const LOCATION_MAX_AGE = 15000;
export const HEADING_MAX_AGE = 5000;
export const PROGRESS_MAX_ACCURACY = 6;
export const ARRIVAL_MAX_ACCURACY = 3;
export const GPS_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

export const validGeo = (p) => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
export const isFresh = (timestamp, now = Date.now(), maxAge = LOCATION_MAX_AGE) =>
  Number.isFinite(timestamp) && timestamp <= now + 1000 && now - timestamp <= maxAge;
export const validGps = (position, accuracy, timestamp, now = Date.now()) =>
  validGeo(position) && Number.isFinite(accuracy) && accuracy >= 0
  && accuracy <= getNavigationPolicy().gps_max_accuracy_m && isFresh(timestamp, now);

// Keep quality and acquisition time with every fix, including origin selection.
export const gpsMeasurement = (position, previous = null, now = Date.now()) => {
  const geo = { lat: position?.coords?.latitude, lng: position?.coords?.longitude };
  const accuracy = position?.coords?.accuracy;
  const timestamp = position?.timestamp;
  return validGps(geo, accuracy, timestamp, now)
    && (!previous || timestamp > previous.timestamp)
    ? { ...geo, accuracy, timestamp, source: 'gps' } : null;
};

// getCurrentPosition cannot be cancelled, so also retire its callback when leaving GPS mode.
export const observeGps = (geolocation, onFix, onError, { mapDisplay = false } = {}) => {
  const canObserve = () => mapDisplay || getNavigationPolicy().gps_enabled;
  if (!geolocation || !canObserve()) return () => {};
  let active = true;
  let previous = null;
  const success = position => {
    if (!active || !canObserve()) return;
    const fix = gpsMeasurement(position, previous);
    if (!fix) return;
    previous = fix;
    onFix(fix);
  };
  const failure = error => { if (active) onError?.(error); };
  geolocation.getCurrentPosition(success, failure, GPS_OPTIONS);
  const watchId = geolocation.watchPosition(success, failure, GPS_OPTIONS);
  return () => {
    active = false;
    if (watchId != null) geolocation.clearWatch(watchId);
  };
};

const ENDPOINT_GPS_TIMEOUT = 30000;
const locationDisabled = error =>
  /\b(?:location (?:services|provider)|gps)\s+(?:(?:is|are)\s+)?(?:disabled|turned off|off)\b/i.test(error?.message || '');

export function acquireGpsEndpoint(geolocation, { signal, onSample, onFix, onFailure }) {
  if (signal.aborted) return;
  let active = true;
  let watchId;
  let bestAccuracy = null;

  const cleanup = () => {
    active = false;
    clearTimeout(timer);
    signal.removeEventListener('abort', cleanup);
    if (watchId != null) geolocation.clearWatch(watchId);
  };
  const fail = (reason) => {
    if (!active) return;
    cleanup();
    onFailure(reason, bestAccuracy);
  };
  const timer = setTimeout(() => fail(bestAccuracy === null ? 'unavailable' : 'inaccurate'), ENDPOINT_GPS_TIMEOUT);
  signal.addEventListener('abort', cleanup, { once: true });

  const onPosition = position => {
    if (!active) return;
    const point = { lat: position.coords.latitude, lng: position.coords.longitude };
    const { accuracy } = position.coords;
    if (!validGeo(point) || !Number.isFinite(accuracy) || accuracy < 0 || !isFresh(position.timestamp)) return;
    if (accuracy <= Math.min(GPS_MAX_ACCURACY, getNavigationPolicy().gps_max_accuracy_m)) {
      cleanup();
      onFix({ ...point, accuracy, timestamp: position.timestamp, source: 'gps' });
    } else if (bestAccuracy === null || accuracy < bestAccuracy) {
      bestAccuracy = accuracy;
      onSample({ ...point, accuracy, source: 'gps' });
    }
  };
  const onError = error => {
    if (locationDisabled(error)) fail('disabled');
    else if (error.code === 1) fail('permission');
  };

  try {
    watchId = geolocation.watchPosition(onPosition, onError, { ...GPS_OPTIONS, timeout: ENDPOINT_GPS_TIMEOUT });
    if (!active && watchId != null) geolocation.clearWatch(watchId);
  } catch {
    fail('unavailable');
  }
}
