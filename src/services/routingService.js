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

const buildRequestBody = ({ origin, destination, mode, gender }) => {
  const originPayload = buildCoordinatePayload(origin);
  const destinationPayload = buildCoordinatePayload(destination);

  if (!originPayload || !destinationPayload) {
    throw new Error('Missing origin or destination coordinates');
  }

  return {
    mode: mode === 'wheelchair' ? 'wheelchair' : 'walk',
    gender: gender || 'both',
    origin: originPayload,
    destination: destinationPayload
  };
};

const normalizeRouteSegments = (segments = [], destinationName) => {
  const coordinates = [];
  const steps = [];

  segments.forEach((segment, index) => {
    const segCoords = segment?.geometry?.coordinates || [];
    segCoords.forEach((coord, coordIdx) => {
      const key = `${coord[0]}-${coord[1]}`;
      const last = coordinates[coordinates.length - 1];
      if (!last || `${last[0]}-${last[1]}` !== key) {
        coordinates.push(coord);
      }
      // Build a simple step at the end of each segment
      if (coordIdx === segCoords.length - 1) {
        steps.push({
          id: index + 1,
          type: index === segments.length - 1 ? 'stepArriveDestination' : 'stepPassConnection',
          name: destinationName,
          coordinates: [coord[1], coord[0]],
          services: {},
          instruction: segment?.instruction || ''
        });
      }
    });
  });

  if (coordinates.length === 0) {
    return { coordinates: [], steps: [] };
  }

  if (steps.length === 0) {
    const last = coordinates[coordinates.length - 1];
    steps.push({
      id: 1,
      type: 'stepArriveDestination',
      name: destinationName,
      coordinates: [last[1], last[0]],
      services: {},
      instruction: ''
    });
  }

  return { coordinates, steps };
};

export const requestRouting = async ({ origin, destination, mode, gender, signal }) => {
  const body = buildRequestBody({ origin, destination, mode, gender });

  const response = await fetch(`${appConfig.apiBaseUrl}/api/v1/routing/route`, {
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
  const segments = Array.isArray(data.segments) ? data.segments : [];
  const { coordinates, steps } = normalizeRouteSegments(segments, destination?.name || '');

  const geo = coordinates.length
    ? {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates }
      }
    : null;

  const distanceMeters = typeof data.distance_m === 'number' ? data.distance_m : null;
  const durationSeconds = typeof data.duration_s === 'number' ? data.duration_s : null;

  return {
    geo,
    steps,
    distanceMeters,
    durationSeconds,
    mode: data.mode || body.mode,
    gender: data.gender || body.gender,
    alternatives: []
  };
};

export default requestRouting;
