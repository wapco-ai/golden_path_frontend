import { distanceMeters } from '../sensors/GNSS';

const pointToSegmentProjection = (p, a, b) => {
  const apx = p[0] - a[0];
  const apy = p[1] - a[1];
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const ab2 = abx * abx + aby * aby;
  const t = ab2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  return [a[0] + abx * t, a[1] + aby * t, t];
};

export const computeRouteProgress = (routeGeoJSON, snappedPos) => {
  const coords = routeGeoJSON?.geometry?.coordinates || [];
  if (coords.length < 2 || !snappedPos) return null;

  let best = { dist: Number.POSITIVE_INFINITY, segIdx: 0, point: coords[0], t: 0 };
  let walked = 0;
  const segments = [];

  for (let i = 0; i < coords.length - 1; i += 1) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = distanceMeters({ lat: a[1], lng: a[0] }, { lat: b[1], lng: b[0] });
    segments.push(segLen);
    const [px, py, t] = pointToSegmentProjection([snappedPos.lng, snappedPos.lat], a, b);
    const d = distanceMeters({ lat: snappedPos.lat, lng: snappedPos.lng }, { lat: py, lng: px });
    if (d < best.dist) best = { dist: d, segIdx: i, point: [px, py], t };
  }

  for (let i = 0; i < best.segIdx; i += 1) walked += segments[i] || 0;
  walked += (segments[best.segIdx] || 0) * best.t;
  const total = segments.reduce((s, n) => s + n, 0);

  return {
    nearestPoint: { lng: best.point[0], lat: best.point[1] },
    distanceToRouteM: best.dist,
    progressPct: total > 0 ? Math.max(0, Math.min(1, walked / total)) : 0,
    remainingM: Math.max(0, total - walked)
  };
};
