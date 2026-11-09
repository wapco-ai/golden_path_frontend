export const GPS_MAX_ACCURACY = 25;
export const LOCATION_MAX_AGE = 15000;
export const HEADING_MAX_AGE = 5000;

export const validGeo = (p) => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
export const isFresh = (timestamp, now = Date.now(), maxAge = LOCATION_MAX_AGE) =>
  Number.isFinite(timestamp) && timestamp <= now + 1000 && now - timestamp <= maxAge;
export const validGps = (position, accuracy, timestamp, now = Date.now()) =>
  validGeo(position) && Number.isFinite(accuracy) && accuracy >= 0
  && accuracy <= GPS_MAX_ACCURACY && isFresh(timestamp, now);
