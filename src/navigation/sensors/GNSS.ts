export const distanceMeters = (a, b) => {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q));
};

export const isGpsJump = (prev, next, jumpDistanceM, jumpWindowMs) => {
  if (!prev || !next) return false;
  const dt = Math.max(1, next.timestamp - prev.timestamp);
  if (dt > jumpWindowMs) return false;
  return distanceMeters(prev, next) > jumpDistanceM;
};
