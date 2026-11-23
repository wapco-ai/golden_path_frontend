import { normalizeFloor } from '../utils/floors.js';
import { bearingAtRouteM, projectPointOnRoute } from '../utils/rngNavigation.js';
import { getLineDistanceMeters, sliceLineByDistance } from '../utils/routeSegments.js';
import { requestRouting } from './routingService.js';
import { fetchLandmarkViewImage, NAVIGATION_IMAGE_OPTIONS } from './landmarkViewImageService.js';

const SAMPLE_SPACING_M = 10;

function pointAt(coordinates, metres) {
  const [lng, lat] = sliceLineByDistance(coordinates, metres, metres)[0];
  return { lat, lng };
}

export function createRouteCoverageSamples(geo, fallbackFloor) {
  const geometry = geo?.geometry;
  const segments = geo?.properties?.segments;
  const walks = Array.isArray(segments) && segments.length
    ? segments.filter(segment => segment.kind === 'walk')
    : [{ geometry, floor: fallbackFloor }];

  return walks.flatMap(({ geometry: line, floor }, index) => {
    const level = normalizeFloor(floor);
    if (level === null || line?.type !== 'LineString') return [];

    const coordinates = line.coordinates;
    const length = getLineDistanceMeters(coordinates);
    const count = Math.ceil(length / SAMPLE_SPACING_M);
    return Array.from({ length: count }, (_, sampleIndex) => {
      const start = sampleIndex * length / count;
      const end = (sampleIndex + 1) * length / count;
      const midpoint = (start + end) / 2;
      return {
        leg: index, floor: level, length: end - start, start, legCoordinates: coordinates, legLength: length,
        coordinates: sliceLineByDistance(coordinates, start, end),
        geo: pointAt(coordinates, midpoint),
        heading: bearingAtRouteM(coordinates, midpoint / length),
        status: 'unknown'
      };
    });
  });
}

export function groupRouteCoverage(samples) {
  const groups = [];
  for (const sample of samples) {
    const last = groups.at(-1);
    if (last?.leg === sample.leg && last.status === sample.status) {
      last.coordinates.push(...sample.coordinates.slice(1));
      last.length += sample.length;
    } else {
      groups.push({ id: groups.length, ...sample, coordinates: [...sample.coordinates] });
    }
  }
  return groups.map(group => ({ ...group, geo: pointAt(group.coordinates, group.length / 2) }));
}

export function projectGuidancePreview(location, sections) {
  let nearest = null;
  for (const section of sections) {
    const projection = projectPointOnRoute([location.lng, location.lat], section.coordinates);
    if (!projection || (nearest && projection.lateralDistanceM >= nearest.projection.lateralDistanceM)) continue;
    nearest = { section, projection };
  }
  if (!nearest) return null;

  const { section, projection } = nearest;
  const routeM = (section.start + projection.alongDistanceM) / section.legLength;
  const heading = bearingAtRouteM(section.legCoordinates, routeM) ?? projection.heading;
  return { ...projection.geo, floor: section.floor, heading, fromRoute: true };
}

export async function requestGuidanceRoute(origin, destination, signal) {
  const endpoint = ({ lat, lng, floor }) => ({ coordinates: [lat, lng], floor });
  const route = await requestRouting({
    origin: endpoint(origin), destination: endpoint(destination), floor: origin.floor,
    mode: 'walk', gender: 'both', lang: 'fa', maxAlternatives: 0, signal
  });
  return createRouteCoverageSamples(route.geo, origin.floor === destination.floor ? origin.floor : null);
}

export async function checkRouteCoverage(samples, signal, onProgress) {
  let next = 0;
  let checked = 0;
  const results = samples.slice();
  async function checkNext() {
    while (next < samples.length && !signal.aborted) {
      const index = next++;
      const sample = samples[index];
      let status = 'unknown';
      try {
        const data = await fetchLandmarkViewImage({
          ...NAVIGATION_IMAGE_OPTIONS,
          geo: sample.geo, heading: sample.heading, floor: sample.floor, source: 'guidance_points',
          signal: AbortSignal.any([signal, AbortSignal.timeout(10000)])
        });
        if (data?.status === 'OK' && data.image?.url) status = 'covered';
        else if (data?.status === 'NO_MATCH') status = 'gap';
      } catch {
        // A lookup error is not evidence of a coverage gap.
      }
      if (signal.aborted) return;
      results[index] = { ...sample, status };
      onProgress(++checked, samples.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, samples.length) }, checkNext));
  return results;
}
