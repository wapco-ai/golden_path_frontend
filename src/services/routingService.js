import appConfig from '../config/appConfig.js';

const buildCoordinatePayload = (point) => {
  if (!point?.coordinates || point.coordinates.length < 2) return null;
  const [lat, lon] = point.coordinates;

  return {
    type: 'coordinate',
    lat: Number(lat),
    lon: Number(lon)
  };
};

const buildRequestBody = ({ origin, destination, mode, gender, lang, maxAlternatives }) => {
  const originPayload = buildCoordinatePayload(origin);
  const destinationPayload = buildCoordinatePayload(destination);

  if (!originPayload || !destinationPayload) {
    throw new Error('Missing origin or destination coordinates');
  }
  const normalizedMode =
    mode === 'wheelchair'
      ? 'wheelchair'
      : mode === 'electric-car' || mode === 'van'
        ? 'van'
        : 'walk';

  return {
    mode: normalizedMode,
    gender: gender || 'both',
    lang: lang || 'fa',
    maxAlternatives: typeof maxAlternatives === 'number' ? maxAlternatives : 2,
    origin: originPayload,
    destination: destinationPayload
  };
};

const mapSteps = (steps = [], sahns = []) => {
  const sahnTitles = Array.isArray(sahns)
    ? sahns.map(sahn => sahn?.name).filter(Boolean)
    : [];

  let sahnIndex = 0;

  return steps
    .filter(step => step?.coord?.lat != null && step?.coord?.lon != null)
    .map((step, idx) => {
      const nextStep = steps[idx + 1];
      const start = [Number(step.coord.lat), Number(step.coord.lon)];
      const end =
        nextStep?.coord?.lat != null && nextStep?.coord?.lon != null
          ? [Number(nextStep.coord.lat), Number(nextStep.coord.lon)]
          : start;

      let type = step.type;
      let title = step.title;
      let name = step.title || '';

      if (step.type === 'stepPassDoor' && sahnTitles.length > 0) {
        const sahnName = sahnTitles[Math.min(sahnIndex, sahnTitles.length - 1)];
        type = 'stepPassSahn';
        title = sahnName || title;
        name = sahnName || name;
        sahnIndex += 1;
      }

      const landmarkCandidate =
        step.landmark
        || step.landmarkName
        || step.landmark_name
        || step.referenceLandmark
        || step.reference_landmark
        || step.poi
        || step.poiName
        || step.poi_name
        || step.nearbyLandmark
        || step.nearby_landmark
        || null;

      return {
        id: idx + 1,
        type,
        title,
        name,
        coordinates: [start, end],
        landmark: landmarkCandidate,
        services: step.services || {},
        instruction: title || ''
      };
    });
};

const toGeoLine = (steps = []) => {
  const getPoint = (coord) => {
    if (Array.isArray(coord?.[0])) {
      const [lat, lon] = coord[0];
      return lat != null && lon != null ? [lon, lat] : null;
    }
    if (Array.isArray(coord) && coord.length === 2) {
      const [lat, lon] = coord;
      return lat != null && lon != null ? [lon, lat] : null;
    }
    return null;
  };

  const coords = steps
    .map(step => getPoint(step.coordinates))
    .filter(Boolean);

  return coords.length
    ? { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
    : null;
};

const mapRoute = (route = {}, originName = '', destinationName = '') => {
  const sahns = route.sahns || route.viaPoints || [];
  const steps = mapSteps(route.steps || [], sahns);
  const geo = toGeoLine(steps);
  const distanceMeters =
    typeof route.distanceMeters === 'number'
      ? route.distanceMeters
      : typeof route.distance_m === 'number'
        ? route.distance_m
        : null;
  const durationSeconds =
    typeof route.estimatedMinutes === 'number'
    ? route.estimatedMinutes * 60
      : typeof route.duration_s === 'number'
        ? route.duration_s
        : null;

  return {
    geo,
    steps,
    distanceMeters,
    durationSeconds,
    sahns,
    via: sahns,
    from: originName,
    to: destinationName
  };
};

export const requestRouting = async ({ origin, destination, mode, gender, lang, maxAlternatives, signal }) => {
  const body = buildRequestBody({ origin, destination, mode, gender, lang, maxAlternatives });

  const response = await fetch(appConfig.routingRouteUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Routing request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const mainRoute = mapRoute(data, origin?.name || '', destination?.name || '');
  const alternatives = Array.isArray(data.alternatives)
    ? data.alternatives.map(alt => mapRoute(alt, origin?.name || '', destination?.name || ''))
    : [];

  return {
    ...mainRoute,
    mode: data.mode || body.mode,
    gender: data.gender || body.gender,
    alternatives
  };
};

export default requestRouting;
