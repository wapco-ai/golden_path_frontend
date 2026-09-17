import { getLineDistanceMeters, sliceLineByFraction } from './routeSegments.js';
import { normalizeFloor } from './floors.js';

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
export const activeRouteCoordinates = (geo, step) => isMultifloor(geo)
  ? geo.properties.segments?.find(s => s.id === step?.segmentId)?.geometry?.coordinates || step?.coordinates || []
  : routeCoordinates(geo);

// routeM belongs to one walk segment, never to the concatenation of floors.
export function multifloorSteps(geo, steps, translate = s => s.instruction || s.title || '') {
  if (!isMultifloor(geo)) return null;
  return steps.map((step, index) => {
    const segment = geo.properties.segments.find(s => s.id === step.segmentId);
    const next = steps[index + 1];
    const fromM = Number.isFinite(step.routeM) ? step.routeM : 0;
    const toM = next?.segmentId === step.segmentId && Number.isFinite(next.routeM) ? next.routeM : 1;
    const isWalk = segment?.kind === 'walk' && step.type !== 'stepArriveDestination';
    const coordinates = isWalk
      ? sliceLineByFraction(segment.geometry.coordinates, fromM, toM)
      : (step.coordinates || []).map(([lat, lon]) => [lon, lat]);
    const points = coordinates.length ? coordinates : (step.coordinates || []).map(([lat, lon]) => [lon, lat]);
    const distanceMeters = isWalk ? getLineDistanceMeters(points) : 0;
    const durationSeconds = step.type === 'stepChangeFloor' ? Number(step.duration_s || 0)
      : isWalk ? Number(segment.duration_s) * Math.max(0, toM - fromM) : 0;
    return { ...step, id: index + 1, coordinates: points, fromM, toM, durationSeconds, distanceMeters,
      instruction: step.instruction || translate(step, index), direction: step.type === 'stepArriveDestination' ? 'arrived' : 'straight' };
  });
}
