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
export const observeGps = (geolocation, onFix, onError) => {
  if (!geolocation || !getNavigationPolicy().gps_enabled) return () => {};
  let active = true;
  let previous = null;
  const success = position => {
    if (!active || !getNavigationPolicy().gps_enabled) return;
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
