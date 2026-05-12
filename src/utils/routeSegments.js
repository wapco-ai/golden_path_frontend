const clampRouteM = (value) => Math.max(0, Math.min(1, Number(value)));

const isLngLat = (coord) => Array.isArray(coord)
  && coord.length >= 2
  && Number.isFinite(coord[0])
  && Number.isFinite(coord[1]);

export const haversineMeters = (from, to) => {
  if (!isLngLat(from) || !isLngLat(to)) return 0;

  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const radiusMeters = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return radiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getLineDistanceMeters = (coordinates = []) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return 0;

  return coordinates.slice(1).reduce((total, coord, index) => (
    total + haversineMeters(coordinates[index], coord)
  ), 0);
};

const interpolateCoordinate = (from, to, ratio) => [
  from[0] + (to[0] - from[0]) * ratio,
  from[1] + (to[1] - from[1]) * ratio
];

export const sliceLineByDistance = (coordinates = [], fromDistance, toDistance) => {
  const validCoordinates = Array.isArray(coordinates) ? coordinates.filter(isLngLat) : [];

  if (validCoordinates.length < 2) return [];

  const totalLength = getLineDistanceMeters(validCoordinates);
  if (totalLength <= 0) return validCoordinates.slice(0, 2);

  const startDistance = Math.max(0, Math.min(totalLength, Number(fromDistance)));
  const endDistance = Math.max(startDistance, Math.min(totalLength, Number(toDistance)));
  const segmentCoordinates = [];
  let traversed = 0;

  for (let i = 0; i < validCoordinates.length - 1; i += 1) {
    const start = validCoordinates[i];
    const end = validCoordinates[i + 1];
    const partLength = haversineMeters(start, end);
    const partStartDistance = traversed;
    const partEndDistance = traversed + partLength;

    if (partLength <= 0) {
      traversed = partEndDistance;
      continue;
    }

    if (partEndDistance < startDistance) {
      traversed = partEndDistance;
      continue;
    }

    if (partStartDistance > endDistance) break;

    const startsInsidePart = startDistance >= partStartDistance && startDistance <= partEndDistance;
    const endsInsidePart = endDistance >= partStartDistance && endDistance <= partEndDistance;

    if (startsInsidePart) {
      const ratio = (startDistance - partStartDistance) / partLength;
      segmentCoordinates.push(interpolateCoordinate(start, end, ratio));
    } else if (partStartDistance >= startDistance && partCoordinatesDiffer(segmentCoordinates.at(-1), start)) {
      segmentCoordinates.push(start);
    }

    if (endsInsidePart) {
      const ratio = (endDistance - partStartDistance) / partLength;
      const endPoint = interpolateCoordinate(start, end, ratio);
      if (partCoordinatesDiffer(segmentCoordinates.at(-1), endPoint)) {
        segmentCoordinates.push(endPoint);
      }
      break;
    }

    if (partEndDistance <= endDistance && partCoordinatesDiffer(segmentCoordinates.at(-1), end)) {
      segmentCoordinates.push(end);
    }

    traversed = partEndDistance;
  }

  if (segmentCoordinates.length === 1) {
    segmentCoordinates.push(segmentCoordinates[0]);
  }

  return segmentCoordinates;
};

const partCoordinatesDiffer = (a, b) => !isLngLat(a)
  || !isLngLat(b)
  || a[0] !== b[0]
  || a[1] !== b[1];

export const sliceLineByFraction = (coordinates = [], fromM = 0, toM = 1) => {
  const validCoordinates = Array.isArray(coordinates) ? coordinates.filter(isLngLat) : [];
  const totalLength = getLineDistanceMeters(validCoordinates);

  if (validCoordinates.length < 2 || totalLength <= 0) return [];

  return sliceLineByDistance(
    validCoordinates,
    totalLength * clampRouteM(fromM),
    totalLength * clampRouteM(toM)
  );
};

export const normalizeRouteMSteps = (steps = []) => (Array.isArray(steps) ? steps : [])
  .filter((step) => typeof step?.routeM === 'number' && Number.isFinite(step.routeM))
  .map((step, originalIndex) => ({
    ...step,
    originalIndex,
    routeM: clampRouteM(step.routeM)
  }))
  .sort((a, b) => (a.routeM - b.routeM) || (a.originalIndex - b.originalIndex));

export const buildRouteMSegments = (steps = [], coordinates = []) => {
  const normalizedSteps = normalizeRouteMSteps(steps);

  if (normalizedSteps.length < 2) return [];

  const segments = [];

  for (let i = 0; i < normalizedSteps.length - 1; i += 1) {
    const fromStep = normalizedSteps[i];
    const toStep = normalizedSteps[i + 1];

    if (toStep.routeM <= fromStep.routeM) continue;

    const segmentCoordinates = sliceLineByFraction(coordinates, fromStep.routeM, toStep.routeM);
    if (segmentCoordinates.length < 2) continue;

    segments.push({
      fromM: fromStep.routeM,
      toM: toStep.routeM,
      fromStep,
      step: toStep,
      coordinates: segmentCoordinates,
      title: toStep.title,
      type: toStep.type,
      doorId: toStep.doorId ?? null
    });
  }

  return segments;
};
