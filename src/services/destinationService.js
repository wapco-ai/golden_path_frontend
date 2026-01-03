import appConfig from '../config/appConfig';
import { convertLngLatToUtm32640, convertUtm32640ToLngLat } from '../utils/utm';

const destinationsBaseUrl = `${appConfig.apiBaseUrl}/api/v1/destinations`;
const destinationsUrl = appConfig.destinationsBaseUrl || destinationsBaseUrl;
const destinationSuggestionsUrl = appConfig.destinationSuggestionsUrl || `${destinationsUrl}/suggestions`;

const buildHeaders = (authToken) => {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
};

const normalizeCoordinates = (coordinates) => {
  if (!coordinates) return null;

  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const [lat, lng] = coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }

  if (
    typeof coordinates === 'object' &&
    coordinates !== null &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng)
  ) {
    return { lat: coordinates.lat, lng: coordinates.lng };
  }

  return null;
};

const convertCoordinatesToUtm = (coordinates) => {
  const normalized = normalizeCoordinates(coordinates);
  if (!normalized) return null;

  try {
    return convertLngLatToUtm32640({ lng: normalized.lng, lat: normalized.lat });
  } catch (err) {
    console.warn('failed to convert coordinates to UTM', err);
    return null;
  }
};

const mapDestinationFromApi = (destination = {}) => {
  let coordinates = null;

  if (Number.isFinite(destination.x) && Number.isFinite(destination.y)) {
    try {
      const { lat, lng } = convertUtm32640ToLngLat({ x: Number(destination.x), y: Number(destination.y) });
      coordinates = [lat, lng];
    } catch (err) {
      console.warn('failed to convert UTM to lng/lat', err);
    }
  }

  return {
    ...destination,
    coordinates
  };
};

export const createDestination = async (
  {
    title,
    name,
    description,
    coordinates,
    floor,
    source = 'manual',
    sourceId,
    tags,
    address,
    metadata
  } = {},
  { authToken } = {}
) => {
  const utmCoords = convertCoordinatesToUtm(coordinates);
  if (!utmCoords) {
    throw new Error('Destination coordinates are required to save');
  }

  const payload = {
    title: title || name,
    description: description || '',
    x: utmCoords.x,
    y: utmCoords.y,
    floor: Number.isFinite(floor) ? floor : null,
    source,
    source_id: sourceId ?? null,
    tags: Array.isArray(tags) ? tags : undefined,
    address,
    metadata
  };

  const response = await fetch(destinationsUrl, {
    method: 'POST',
    headers: buildHeaders(authToken),
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Failed to save destination (status ${response.status})`);
  }

  const created = data?.destination || data;
  return mapDestinationFromApi(created);
};

export const fetchDestinations = async ({ source, tag, q, page, pageSize } = {}, { authToken } = {}) => {
  const url = new URL(destinationsUrl);
  if (source) url.searchParams.set('source', source);
  if (tag) url.searchParams.set('tag', tag);
  if (q) url.searchParams.set('q', q);
  if (Number.isFinite(page)) url.searchParams.set('page', page);
  if (Number.isFinite(pageSize)) url.searchParams.set('page_size', pageSize);

  const response = await fetch(url.toString(), {
    headers: buildHeaders(authToken)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Failed to fetch destinations (status ${response.status})`);
  }

  const items = Array.isArray(data?.items) ? data.items : data;
  const pagination = data?.pagination;

  return {
    items: (items || []).map(mapDestinationFromApi),
    pagination
  };
};

export const fetchDestinationDetails = async (id, { authToken } = {}) => {
  if (!id) throw new Error('destination id is required');

  const response = await fetch(`${destinationsUrl}/${id}`, {
    headers: buildHeaders(authToken)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Failed to fetch destination (status ${response.status})`);
  }

  return mapDestinationFromApi(data?.destination || data);
};

export const updateDestination = async (id, updates = {}, { authToken } = {}) => {
  if (!id) throw new Error('destination id is required');

  const utmCoords = updates.coordinates ? convertCoordinatesToUtm(updates.coordinates) : null;

  const payload = {
    ...updates,
    ...(utmCoords ? { x: utmCoords.x, y: utmCoords.y } : {})
  };

  const response = await fetch(`${destinationsUrl}/${id}`, {
    method: 'PUT',
    headers: buildHeaders(authToken),
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Failed to update destination (status ${response.status})`);
  }

  return mapDestinationFromApi(data?.destination || data);
};

export const deleteDestination = async (id, { authToken } = {}) => {
  if (!id) throw new Error('destination id is required');

  const response = await fetch(`${destinationsUrl}/${id}`, {
    method: 'DELETE',
    headers: buildHeaders(authToken)
  });

  if (!response.ok) {
    let errorMessage = `Failed to delete destination (status ${response.status})`;
    try {
      const data = await response.json();
      errorMessage = data?.message || errorMessage;
    } catch (err) {
      // ignore json parse errors
    }
    throw new Error(errorMessage);
  }

  return true;
};

export const fetchDestinationSuggestions = async ({ authToken } = {}) => {
  const response = await fetch(destinationSuggestionsUrl, {
    headers: buildHeaders(authToken)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || `Failed to fetch destination suggestions (status ${response.status})`);
  }

  return {
    recent: Array.isArray(data?.recent) ? data.recent.map(mapDestinationFromApi) : [],
    popular: Array.isArray(data?.popular) ? data.popular.map(mapDestinationFromApi) : []
  };
};

export default {
  createDestination,
  fetchDestinations,
  fetchDestinationDetails,
  updateDestination,
  deleteDestination,
  fetchDestinationSuggestions
};
