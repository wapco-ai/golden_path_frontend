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

  return {
    mode: mode === 'wheelchair' ? 'wheelchair' : 'walk',
    gender: gender || 'both',
    lang: lang || 'fa',
    maxAlternatives: typeof maxAlternatives === 'number' ? maxAlternatives : 2,
    origin: originPayload,
    destination: destinationPayload
  };
};

const mapSteps = (steps = []) => {
  return steps
    .filter(step => step?.coord?.lat != null && step?.coord?.lon != null)
    .map((step, idx) => ({
      id: idx + 1,
      type: step.type,
      title: step.title,
      name: step.title || '',
      coordinates: [step.coord.lat, step.coord.lon],
      services: step.services || {},
      instruction: step.title || ''
    }));
};

const toGeoLine = (steps = []) => {
  const coords = steps
    .map(step => step.coordinates)
    .filter(coord => Array.isArray(coord) && coord.length === 2)
    .map(([lat, lon]) => [lon, lat]);

  return coords.length
    ? { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
    : null;
};

const mapRoute = (route = {}, originName = '', destinationName = '') => {
  const steps = mapSteps(route.steps || []);
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
  const sahns = route.sahns || route.viaPoints || [];

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
