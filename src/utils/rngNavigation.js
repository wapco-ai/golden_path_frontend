import { isFresh } from './locationQuality.js';
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
export const projectPointOnRoute = (point, coordinates = [], { minAlong = 0, maxAlong = Infinity } = {}) => {
  if (!isCoordinate(point) || !Array.isArray(coordinates) || coordinates.length < 2) return null;
  if (!coordinates.every(isCoordinate)) return null;
  const longitudeScale = 111320 * Math.cos(radians(point[1]));
  let best = null;
  const candidates = [];
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
    const alongDistanceM = traversed + t * length;
    if (alongDistanceM >= minAlong && alongDistanceM <= maxAlong) {
      const candidate = { lateralDistanceM, alongDistanceM, segmentIndex: i,
        geo: { lng: a[0] + t * (b[0] - a[0]), lat: a[1] + t * (b[1] - a[1]) },
        heading: (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360 };
      candidates.push(candidate);
      if (!best || lateralDistanceM < best.lateralDistanceM) best = candidate;
    }
    traversed += length;
  }
  return best && traversed > 0
    ? { ...best, routeM: best.alongDistanceM / traversed, totalDistanceM: traversed, candidates }
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

// Use the outgoing route tangent at the marker; at the route end use the
// incoming tangent. Repeated coordinates carry no direction and are skipped.
const bearingAtRouteM = (coordinates, routeM) => {
  if (routeM === null) return null;
  const forward = sliceLineByFraction(coordinates, routeM, 1);
  for (let i = 1; i < forward.length; i += 1) {
    const heading = getBearing(forward[0], forward[i]);
    if (heading !== null) return heading;
  }
  const backward = sliceLineByFraction(coordinates, 0, routeM);
  for (let i = backward.length - 2; i >= 0; i -= 1) {
    const heading = getBearing(backward[i], backward.at(-1));
    if (heading !== null) return heading;
  }
  return null;
};

export const getStepPreview = (step, routeCoordinates = [], stepIndex = 0) => {
  if (step?.type === 'stepChangeFloor') {
    const point = step.coordinates?.[0];
    const routeEnd = routeCoordinates.at(-1);
    const heading = isCoordinate(point) && isCoordinate(routeEnd) && haversineMeters(point, routeEnd) <= 3
      ? bearingAtRouteM(routeCoordinates, 1) : null;
    return { geo: asGeo(point), heading: heading ?? (Number.isFinite(step.heading) ? step.heading : null),
      routeM: null, coordinates: isCoordinate(point) ? [point, point] : [] };
  }
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
  const explicitStart = fraction(step?.fromM) ?? fraction(step?.routeM);
  const projectedStart = explicitStart === null
    ? projectPointOnRoute(coordinates[0], routeCoordinates) : null;
  // A stair instruction stays active through the exit but is previewed at the entrance.
  const stairEntrance = step?.type === 'stepUseStairs' ? fraction(step.routeStep?.routeM) : null;
  const previewM = step?.previewAt === 'end' ? stairEntrance ?? toM
    : explicitStart ?? (projectedStart?.lateralDistanceM <= 3 ? projectedStart.routeM : null);
  const marker = previewM !== null
    ? sliceLineByFraction(routeCoordinates, previewM, previewM)[0]
    : null;
  const point = marker || (step?.previewAt === 'end' ? coordinates.at(-1) : coordinates[0]);
  let heading = bearingAtRouteM(routeCoordinates, previewM);
  if (heading === null) {
    if (step?.previewAt === 'end') {
      for (let i = coordinates.length - 2; i >= 0 && heading === null; i -= 1) {
        heading = getBearing(coordinates[i], point);
      }
    } else {
      for (let i = 1; i < coordinates.length && heading === null; i += 1) {
        heading = getBearing(point, coordinates[i]);
      }
    }
  }
  if (heading === null && Number.isFinite(step?.heading)) heading = ((step.heading % 360) + 360) % 360;
  const geo = asGeo(point);
  return { geo, heading, routeM: previewM, coordinates };
};

export const getLiveNavigationGeo = ({ isDrActive, drPosition, userLocation, drTimestamp, gpsTimestamp, now = Date.now() }) => {
  if (isDrActive && (drTimestamp === undefined || isFresh(drTimestamp, now))
    && (drTimestamp === undefined || !isFresh(gpsTimestamp, now) || drTimestamp > gpsTimestamp)
    && isNavigationGeo(drPosition)) return { lat: drPosition.lat, lng: drPosition.lng };
  if ((gpsTimestamp === undefined || isFresh(gpsTimestamp, now)) && Array.isArray(userLocation)) return asGeo([userLocation[1], userLocation[0]]);
  return null;
};

export const resolveNavigationFrame = ({
  step, stepIndex = 0, routeCoordinates = [], isRoutingActive = false,
  isDemoMode = false, hasArrived = false, isDrActive = false,
  drPosition, userLocation, userHeading, liveHeading, sessionFloor = 0, drTimestamp, gpsTimestamp, now, anchorGeo, liveRouteM
}) => {
  const live = isRoutingActive && !isDemoMode;
  const preview = getStepPreview(live && step?.previewAt === 'end'
    ? { ...step, previewAt: 'start' } : step, routeCoordinates, stepIndex);
  const liveGeo = getLiveNavigationGeo({ isDrActive, drPosition, userLocation, drTimestamp, gpsTimestamp, now });
  // Keep the last measured marker visible when a signal expires. Only liveGeo
  // can be used by navigation progress or emergency reporting.
  const lastKnownGeo = Number.isFinite(drTimestamp) && isNavigationGeo(drPosition)
    && (!Number.isFinite(gpsTimestamp) || drTimestamp > gpsTimestamp)
    ? drPosition : Number.isFinite(gpsTimestamp) && Array.isArray(userLocation)
      ? asGeo([userLocation[1], userLocation[0]]) : null;
  const geo = hasArrived ? asGeo(routeCoordinates.at(-1))
    : live ? (liveGeo || lastKnownGeo || anchorGeo || preview.geo) : preview.geo;
  const projection = isNavigationGeo(geo) ? projectPointOnRoute([geo.lng, geo.lat], routeCoordinates) : null;
  const floor = [step?.floor, step?.routeStep?.floor, sessionFloor]
    .find((value) => value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)));
  const heading = preview.heading ?? (live && Number.isFinite(userHeading) ? ((userHeading % 360) + 360) % 360 : null);
  return {
    geo,
    heading,
    mapHeading: live && Number.isFinite(liveHeading) ? liveHeading : heading,
    floor: floor === undefined ? 0 : Number(floor),
    mode: isDemoMode ? 'demo' : hasArrived ? 'arrived' : live ? 'live' : 'preview',
    routeM: hasArrived ? 1 : live && Number.isFinite(liveRouteM) ? liveRouteM : live
      ? (projection && projection.lateralDistanceM <= 10
        ? Math.max(getStepStartRouteM(step, routeCoordinates) ?? 0, projection.routeM)
        : (getStepStartRouteM(step, routeCoordinates) ?? 0))
      : (preview.routeM ?? 0)
  };
};

export const getNavigationProgress = (geo, steps, currentStep, routeCoordinates, options = {}) => {
  const arrivalRadius = options.arrivalRadius ?? 3;
  const unchanged = { nextStep: currentStep, arrived: false };
  if (!isNavigationGeo(geo) || !Array.isArray(steps) || !steps[currentStep]) return unchanged;
  if (steps[currentStep].type === 'stepChangeFloor') return unchanged;
  const point = [geo.lng, geo.lat];
  const projection = options.projection === undefined ? projectPointOnRoute(point, routeCoordinates) : options.projection;
  if (!projection) {
    // A landing can coincide exactly with the origin/destination. It still cannot skip a transfer.
    const current = steps[currentStep];
    const next = steps[currentStep + 1];
    const atPoint = current.segmentId != null && routeCoordinates.length >= 2
      && routeCoordinates.every(p => isCoordinate(p) && haversineMeters(routeCoordinates[0], p) < 0.01)
      && haversineMeters(point, routeCoordinates[0]) <= arrivalRadius;
    if (atPoint && next) return { nextStep: currentStep + 1, arrived: false };
    if (atPoint && current.type === 'stepArriveDestination') return { ...unchanged, arrived: true };
    return unchanged;
  }
  if (currentStep === steps.length - 1) {
    const nearEnd = haversineMeters(point, routeCoordinates.at(-1)) <= arrivalRadius;
    return { ...unchanged, arrived: nearEnd && projection.lateralDistanceM <= 6
      && projection.alongDistanceM >= projection.totalDistanceM - arrivalRadius };
  }
  const current = steps[currentStep];
  const stairExit = fraction(current.routeStep?.endRouteM ?? current.endRouteM);
  if (current.type === 'stepUseStairs' && stairExit !== null
      && projection.alongDistanceM < stairExit * projection.totalDistanceM - 1) return unchanged;

  const next = steps[currentStep + 1];
  const boundary = getStepStartRouteM(next, routeCoordinates);
  const passed = boundary !== null
    && projection.alongDistanceM >= boundary * projection.totalDistanceM - 5;
  const nextCoordinate = getStepPreview(next, routeCoordinates, currentStep + 1).coordinates[0];
  const nearNext = isCoordinate(nextCoordinate) && haversineMeters(point, nextCoordinate) <= 6;
  return projection.lateralDistanceM <= 10 && (passed || (boundary === null && nearNext))
    ? { nextStep: currentStep + 1, arrived: false } : unchanged;
};

export const nextDemoStep = (currentStep, count) => count > 0 ? (currentStep + 1) % count : 0;
