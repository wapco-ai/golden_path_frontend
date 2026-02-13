import appConfig from '../config/appConfig.js';

const inflightRequests = new Map();
const responseCache = new Map();
const CACHE_TTL_MS = 1500;

const RAW_BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

const resolveMediaValue = (media, defaultMime = 'image/jpeg') => {
  if (!media) return null;

  if (typeof media === 'object') {
    if (media.url) return resolveMediaValue(media.url, media.mime || defaultMime);
    if (media.path) return resolveMediaValue(media.path, media.mime || defaultMime);
    if (media.data) return `data:${media.mime || defaultMime};base64,${media.data}`;
    return null;
  }

  if (typeof media !== 'string') return null;

  const trimmed = media.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;

  const normalized = trimmed.replace(/\s+/g, '');
  if (RAW_BASE64_REGEX.test(normalized)) {
    return `data:${defaultMime};base64,${normalized}`;
  }

  if (trimmed.startsWith('/')) {
    return `${appConfig.apiBaseUrl}${trimmed}`;
  }

  if (!trimmed.includes('://') && !trimmed.startsWith('//')) {
    return `${appConfig.apiBaseUrl}/${trimmed.replace(/^\.\//, '')}`;
  }

  try {
    const parsedUrl = new URL(trimmed);
    const isLocalHost = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';

    if (isLocalHost) {
      const apiBase = new URL(appConfig.apiBaseUrl);
      return `${apiBase.origin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }
  } catch {
    return trimmed;
  }

  return trimmed;
};

const normalizeLandmarkPlace = (place = {}) => {
  const primaryImage = resolveMediaValue(place.image);
  const fallbackImage = resolveMediaValue(place.images);

  return {
    ...place,
    image: primaryImage || fallbackImage || place.image,
    images: Array.isArray(place.images)
      ? place.images.map((item) => resolveMediaValue(item)).filter(Boolean)
      : place.images
  };
};

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
    const normalizedData = {
      ...data,
      places: {
        ...(data?.places || {}),
        landmarkPlaces: Array.isArray(data?.places?.landmarkPlaces)
          ? data.places.landmarkPlaces.map(normalizeLandmarkPlace)
          : data?.places?.landmarkPlaces
      }
    };

    responseCache.set(requestKey, { data: normalizedData, timestamp: Date.now() });
    return normalizedData;
  })();

  inflightRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inflightRequests.delete(requestKey);
  }
};

export default fetchLandmarkPlaces;
