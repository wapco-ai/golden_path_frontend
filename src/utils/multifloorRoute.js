import { getLineDistanceMeters, haversineMeters, sliceLineByFraction } from './routeSegments.js';
import { normalizeFloor } from './floors.js';
import { elapsedDuration, serverStepDuration } from './routeDuration.js';

export const isMultifloor = geo => geo?.properties?.multifloor === true;
// For bounds/point lookup only. Never draw these flattened coordinates as a line.
export const routeCoordinates = geo => geo?.geometry?.type === 'MultiLineString'
  ? geo.geometry.coordinates.flat() : geo?.geometry?.coordinates || [];
export const routeOnFloor = (geo, floor, predicate = () => true) => {
  if (!isMultifloor(geo)) return geo;
  return { type: 'FeatureCollection', features: (geo.properties.segments || [])
    .filter(s => s.kind === 'walk' && Number(s.floor) === Number(floor) && predicate(s))
    .map(s => ({ type: 'Feature', geometry: s.geometry, properties: { floor: s.floor, segmentId: s.id } })) };
};
// Public map browsing can also hide an ordinary single-floor route.
export const routeOnMapFloor = (geo, floor, originFloor) => {
  if (isMultifloor(geo)) return routeOnFloor(geo, floor);
  const routeFloor = normalizeFloor(geo?.properties?.floor) ?? normalizeFloor(originFloor);
  return routeFloor !== null && routeFloor === normalizeFloor(floor)
    ? geo : { type: 'FeatureCollection', features: [] };
};
export const routeCoordinatesOnFloor = (geo, floor, originFloor) => {
  const visible = routeOnMapFloor(geo, floor, originFloor);
  return visible?.type === 'FeatureCollection'
    ? visible.features.flatMap(feature => routeCoordinates(feature)) : routeCoordinates(visible);
};
export const activeRouteCoordinates = (geo, step) => {
  if (!isMultifloor(geo)) return routeCoordinates(geo);
  const segments = geo.properties.segments || [];
  const index = segments.findIndex(s => s.id === step?.segmentId);
  const coordinates = segments[index]?.geometry?.coordinates;
  if (coordinates?.length) return coordinates;
  if (step?.type === 'stepChangeFloor' && index >= 0) {
    const point = step.coordinates?.[0];
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = segments[i];
      if (previous.kind !== 'walk' || Number(previous.floor) !== Number(step.floor)) continue;
      const line = previous.geometry?.coordinates;
      if (Array.isArray(point) && line?.length >= 2 && haversineMeters(point, line.at(-1)) <= 3) return line;
      break;
    }
  }
  return step?.coordinates || [];
};

// Saved routes can still contain the old floor-zero wording.
function formatFloorChangeInstruction(instruction) {
  return instruction
    .replace(/ به طبقه[ٔ‌ی]? [0۰٠] بروید\.$/u, ' به طبقه همکف بروید.')
    .replace(/ to floor 0\.$/, ' to the ground floor.')
    .replace(/ إلى الطابق [0٠]\.$/u, ' إلى الطابق الأرضي.')
    .replace(/ سے منزل [0۰] پر جائیں۔$/u, ' سے گراؤنڈ فلور پر جائیں۔');
}

// routeM belongs to one walk segment, never to the concatenation of floors.
export function multifloorSteps(geo, steps, translate = s => s.instruction || s.title || '') {
  if (!isMultifloor(geo)) return null;
  return steps.map((step, index) => {
    const segment = geo.properties.segments.find(s => s.id === step.segmentId);
    const next = steps[index + 1];
    const nextOnSegment = next?.segmentId === step.segmentId ? next : undefined;
    const fromM = Number.isFinite(step.routeM) ? step.routeM : 0;
    const toM = Number.isFinite(nextOnSegment?.routeM) ? nextOnSegment.routeM : 1;
    const isWalk = segment?.kind === 'walk' && step.type !== 'stepArriveDestination';
    const coordinates = isWalk
      ? sliceLineByFraction(segment.geometry.coordinates, fromM, toM)
      : (step.coordinates || []).map(([lat, lon]) => [lon, lat]);
    const points = coordinates.length ? coordinates : (step.coordinates || []).map(([lat, lon]) => [lon, lat]);
    const distanceMeters = isWalk ? getLineDistanceMeters(points) : 0;
    let durationSeconds = serverStepDuration(step);
    if (isWalk) {
      const endElapsed = nextOnSegment ? nextOnSegment.elapsed_s : segment.duration_s;
      durationSeconds = elapsedDuration(step.elapsed_s, endElapsed) ?? durationSeconds;
      if (durationSeconds == null && Number.isFinite(segment.duration_s)) {
        durationSeconds = segment.duration_s * Math.max(0, toM - fromM);
      }
    } else if (step.type === 'stepChangeFloor') {
      durationSeconds ??= segment?.duration_s;
    } else if (step.type === 'stepArriveDestination') {
      durationSeconds ??= 0;
    }
    const instruction = step.instruction || translate(step, index);
    return { ...step, id: index + 1, coordinates: points, fromM, toM, durationSeconds, distanceMeters,
      instruction: step.type === 'stepChangeFloor' && normalizeFloor(step.toFloor) === 0
        ? formatFloorChangeInstruction(instruction) : instruction,
      direction: step.maneuver || (step.type === 'stepArriveDestination' ? 'arrived' : 'straight') };
  });
}
