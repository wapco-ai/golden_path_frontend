import appConfig from '../config/appConfig.js';

const inflightRequests = new Map();
const responseCache = new Map();
const CACHE_TTL_MS = 1500;

const createRequestKey = (url, params) => `${url}?${params.toString()}`;

export const fetchLandmarkPlaces = async ({
  language = 'fa',
  geo,
  poiId,
  search,
  limit,
  featured,
  signal
} = {}) => {
  const url = appConfig.landmarkPlacesUrl;

  const params = new URLSearchParams();
  params.set('language', language || 'fa');

  if (limit != null) {
    params.set('limit', limit);
  }

  if (poiId != null) {
    params.set('poi_id', poiId);
  }

  if (search) {
    params.set('search', search);
  }

  if (featured != null) {
    params.set('featured', featured);
  }

  if (geo?.lat != null && geo?.lng != null) {
    params.set('geo[lat]', geo.lat);
    params.set('geo[lng]', geo.lng);
  }

  const requestKey = createRequestKey(url, params);
  const now = Date.now();
  const cachedEntry = responseCache.get(requestKey);

  if (cachedEntry && now - cachedEntry.timestamp <= CACHE_TTL_MS) {
    return cachedEntry.data;
  }

  const inflightRequest = inflightRequests.get(requestKey);
  if (inflightRequest) {
    return inflightRequest;
  }

  const requestPromise = (async () => {
    const response = await fetch(requestKey, {
      headers: { Accept: 'application/json' },
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch landmark places: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    responseCache.set(requestKey, { data, timestamp: Date.now() });
    return data;
  })();

  inflightRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(requestKey);
  }
};

export default fetchLandmarkPlaces;
