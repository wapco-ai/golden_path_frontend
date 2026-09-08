import { haversineMeters, sliceLineByFraction } from './routeSegments.js';

const fraction = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : null;
const isCoordinate = (p) => Array.isArray(p) && p.length >= 2
  && Number.isFinite(p[0]) && Number.isFinite(p[1])
  && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
export const isNavigationGeo = (p) => p != null
  && Number.isFinite(p.lng) && Number.isFinite(p.lat)
  && Math.abs(p.lng) <= 180 && Math.abs(p.lat) <= 90;
const asGeo = (p) => isCoordinate(p) ? { lng: p[0], lat: p[1] } : null;
const radians = (value) => value * Math.PI / 180;

// Operates only on the server's route polyline, never on doors or POI geometry.
export const projectPointOnRoute = (point, coordinates = []) => {
  if (!isCoordinate(point) || !Array.isArray(coordinates) || coordinates.length < 2) return null;
  if (!coordinates.every(isCoordinate)) return null;
  const longitudeScale = 111320 * Math.cos(radians(point[1]));
  let best = null;
  let traversed = 0;
  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    const length = haversineMeters(a, b);
    if (length <= 0) continue;
    const ax = (a[0] - point[0]) * longitudeScale;
    const ay = (a[1] - point[1]) * 111320;
    const dx = (b[0] - a[0]) * longitudeScale;
    const dy = (b[1] - a[1]) * 111320;
    const squareLength = dx * dx + dy * dy;
    const t = squareLength > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / squareLength)) : 0;
    const lateralDistanceM = Math.hypot(ax + t * dx, ay + t * dy);
    if (!best || lateralDistanceM < best.lateralDistanceM) {
      best = { lateralDistanceM, alongDistanceM: traversed + t * length, segmentIndex: i };
    }
    traversed += length;
  }
  return best && traversed > 0
    ? { ...best, routeM: best.alongDistanceM / traversed, totalDistanceM: traversed }
    : null;
};

export const getStepStartRouteM = (step, routeCoordinates = []) => {
  // Display segments have fromM/toM. Their routeStep.routeM marks the END,
  // so do not use it as the start and never guess index / (stepCount - 1).
  const start = fraction(step?.fromM) ?? fraction(step?.routeM);
  if (start !== null) return start;
  return projectPointOnRoute(step?.coordinates?.[0], routeCoordinates)?.routeM ?? null;
};

const getBearing = (a, b) => {
  if (!isCoordinate(a) || !isCoordinate(b) || haversineMeters(a, b) < 0.001) return null;
  const dLng = radians(b[0] - a[0]);
  const lat1 = radians(a[1]);
  const lat2 = radians(b[1]);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

export const getStepPreview = (step, routeCoordinates = [], stepIndex = 0) => {
  const fromM = fraction(step?.fromM);
  const toM = fraction(step?.toM);
  let coordinates = Array.isArray(step?.coordinates) ? step.coordinates.filter(isCoordinate) : [];
  if (fromM !== null && toM !== null && toM > fromM) {
    coordinates = sliceLineByFraction(routeCoordinates, fromM, toM);
  }
  // A raw vertex index is not a step index. Only the very first step can
  // safely use the route start when its coordinates are unavailable.
  if (!coordinates.length && stepIndex === 0 && routeCoordinates.every(isCoordinate)) {
    coordinates = routeCoordinates.slice(0, 2);
  }
  let heading = getBearing(coordinates[0], coordinates.at(-1));
  if (heading === null) {
    for (let i = 1; i < coordinates.length && heading === null; i += 1) {
      heading = getBearing(coordinates[0], coordinates[i]);
    }
  }
  if (heading === null && Number.isFinite(step?.heading)) heading = ((step.heading % 360) + 360) % 360;
  const geo = asGeo(coordinates[0]);
  return { geo, heading, routeM: getStepStartRouteM(step, routeCoordinates), coordinates };
};

export const getLiveNavigationGeo = ({ isDrActive, drPosition, userLocation }) => {
  if (isDrActive && isNavigationGeo(drPosition)) return { lat: drPosition.lat, lng: drPosition.lng };
  if (Array.isArray(userLocation)) return asGeo([userLocation[1], userLocation[0]]);
  return null;
};

export const resolveNavigationFrame = ({
  step, stepIndex = 0, routeCoordinates = [], isRoutingActive = false,
  isDemoMode = false, hasArrived = false, isDrActive = false,
  drPosition, userLocation, userHeading, sessionFloor = 0
}) => {
  const preview = getStepPreview(step, routeCoordinates, stepIndex);
  const live = isRoutingActive && !isDemoMode;
  const liveGeo = getLiveNavigationGeo({ isDrActive, drPosition, userLocation });
  const geo = hasArrived ? asGeo(routeCoordinates.at(-1))
    : live ? (liveGeo || preview.geo) : preview.geo;
  const projection = isNavigationGeo(geo) ? projectPointOnRoute([geo.lng, geo.lat], routeCoordinates) : null;
  const floor = [step?.floor, step?.routeStep?.floor, sessionFloor]
    .find((value) => value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)));
  return {
    geo,
    heading: preview.heading ?? (Number.isFinite(userHeading) ? ((userHeading % 360) + 360) % 360 : null),
    floor: floor === undefined ? 0 : Number(floor),
    mode: isDemoMode ? 'demo' : hasArrived ? 'arrived' : live ? 'live' : 'preview',
    routeM: hasArrived ? 1 : live && projection && projection.lateralDistanceM <= 10
      ? Math.max(preview.routeM ?? 0, projection.routeM) : (preview.routeM ?? 0)
  };
};

export const getNavigationProgress = (geo, steps, currentStep, routeCoordinates) => {
  const unchanged = { nextStep: currentStep, arrived: false };
  if (!isNavigationGeo(geo) || !Array.isArray(steps) || !steps[currentStep]) return unchanged;
  const point = [geo.lng, geo.lat];
  const projection = projectPointOnRoute(point, routeCoordinates);
  if (!projection) return unchanged;
  if (currentStep === steps.length - 1) {
    const nearEnd = haversineMeters(point, routeCoordinates.at(-1)) <= 3;
    return { ...unchanged, arrived: nearEnd && projection.lateralDistanceM <= 6
      && projection.alongDistanceM >= projection.totalDistanceM - 3 };
  }
  const next = steps[currentStep + 1];
  const boundary = getStepStartRouteM(next, routeCoordinates);
  const passed = boundary !== null
    && projection.alongDistanceM >= boundary * projection.totalDistanceM - 5;
  const nextCoordinate = getStepPreview(next, routeCoordinates, currentStep + 1).coordinates[0];
  const nearNext = isCoordinate(nextCoordinate) && haversineMeters(point, nextCoordinate) <= 6;
  return projection.lateralDistanceM <= 10 && (passed || nearNext)
    ? { nextStep: currentStep + 1, arrived: false } : unchanged;
};

export const nextDemoStep = (currentStep, count) => count > 0 ? (currentStep + 1) % count : 0;
