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

const normalizeStepsPayload = (steps = []) => {
  if (Array.isArray(steps)) return steps;
  if (!steps || typeof steps !== 'object') return [];

  return Object.entries(steps)
    .map(([key, value]) => ({
      ...value,
      __payloadOrder: Number.isFinite(Number(key)) ? Number(key) : Number.MAX_SAFE_INTEGER
    }))
    .sort((a, b) => {
      const aOrder = Number.isFinite(Number(a?.stepOrder)) ? Number(a.stepOrder) : a.__payloadOrder;
      const bOrder = Number.isFinite(Number(b?.stepOrder)) ? Number(b.stepOrder) : b.__payloadOrder;
      return aOrder - bOrder;
    });
};

const normalizePersianDoorName = (title = '', toAreaName = '') => {
  const trimmedTitle = typeof title === 'string' ? title.trim() : '';
  const trimmedArea = typeof toAreaName === 'string' ? toAreaName.trim() : '';

  if (!trimmedTitle) return '';
  if (!trimmedArea) return trimmedTitle;

  const splitPattern = new RegExp(`\\s+به\\s+${trimmedArea.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  const exactAreaPrefix = trimmedArea.startsWith('صحن ') ? trimmedArea.replace(/^صحن\s+/, '') : trimmedArea;
  const genericSplit = trimmedTitle.split(/\s+به\s+/);

  if (splitPattern.test(trimmedTitle)) {
    return trimmedTitle.replace(splitPattern, '').trim();
  }

  if (genericSplit.length > 1) {
    return genericSplit.slice(0, -1).join(' به ').trim();
  }

  if (exactAreaPrefix && trimmedTitle.endsWith(exactAreaPrefix)) {
    return trimmedTitle.slice(0, -exactAreaPrefix.length).trim();
  }

  return trimmedTitle;
};

const buildStepInstruction = (step, type, name, title) => {
  if (typeof step?.instruction === 'string' && step.instruction.trim().length > 0) {
    return step.instruction.trim();
  }

  if (type === 'stepPassDoor') {
    const doorName = name || step?.title || '';
    const areaName = step?.toAreaName || title || '';

    if (doorName && areaName) {
      return `از ${doorName} عبور کنید و به ${areaName} بروید`;
    }
  }

  return '';
};

const mapSteps = (steps = []) => {
  const normalizedSteps = normalizeStepsPayload(steps);

  return normalizedSteps
    .filter(step => step?.coord?.lat != null && step?.coord?.lon != null)
    .map((step, idx, validSteps) => {
      const nextStep = validSteps[idx + 1];
      const start = [Number(step.coord.lat), Number(step.coord.lon)];
      const end =
        nextStep?.coord?.lat != null && nextStep?.coord?.lon != null
          ? [Number(nextStep.coord.lat), Number(nextStep.coord.lon)]
          : start;

      let type = step.type;
      const isDoorStep = step.type === 'stepPassDoor';
      const doorName = isDoorStep ? normalizePersianDoorName(step.title, step.toAreaName) : '';
      const title = isDoorStep && step.toAreaName ? step.toAreaName : step.title;
      const name = isDoorStep ? (doorName || step.title || '') : (step.title || '');

      const isLegacyStartStep =
        idx === 0 &&
        step.type === 'stepPassConnection' &&
        typeof step.title === 'string' &&
        step.title.trim() === 'شروع حرکت';

      if (isLegacyStartStep) {
        type = 'stepStart';
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
        originalTitle: step.title,
        coordinates: [start, end],
        landmark: landmarkCandidate,
        services: step.services || {},
        doorId: step.doorId ?? null,
        edgeId: step.edgeId ?? null,
        routeM: step.routeM,
        stepOrder: step.stepOrder ?? idx + 1,
        fromAreaId: step.fromAreaId ?? null,
        toAreaId: step.toAreaId ?? null,
        fromAreaName: step.fromAreaName || '',
        toAreaName: step.toAreaName || '',
        instruction: buildStepInstruction(step, type, name, title)
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


const normalizeGeoFeature = (route = {}) => {
  const rawGeo =
    route.geo ||
    route.routeGeo ||
    route.route_geo ||
    null;

  if (rawGeo?.type === 'Feature' && rawGeo?.geometry?.coordinates?.length) {
    return rawGeo;
  }

  const rawGeometry =
    route.geometry ||
    route.geom ||
    route.routeGeometry ||
    route.route_geometry ||
    null;

  if (rawGeometry?.type && rawGeometry?.coordinates?.length) {
    return {
      type: 'Feature',
      geometry: rawGeometry,
      properties: {}
    };
  }

  if (typeof rawGeometry === 'string') {
    try {
      const parsed = JSON.parse(rawGeometry);
      if (parsed?.type && parsed?.coordinates?.length) {
        return {
          type: 'Feature',
          geometry: parsed,
          properties: {}
        };
      }
    } catch {
      return null;
    }
  }

  return null;
};


const mapRoute = (route = {}, originName = '', destinationName = '') => {
  const sahns = route.sahns || route.viaPoints || [];
  const steps = mapSteps(route.steps || []);
  const geo = normalizeGeoFeature(route) || toGeoLine(steps);
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
