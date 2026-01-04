import appConfig from '../config/appConfig';
import { USER_ACCESS_TOKEN_KEY, useUserAuthStore } from '../auth/user/userAuthStore';
import { convertLngLatToUtm32640 } from '../utils/utm';

const resolveAuthToken = () => {
  const storeToken = useUserAuthStore.getState().accessToken;
  if (storeToken) return storeToken;

  if (typeof window !== 'undefined') {
    const sessionToken = window.sessionStorage?.getItem?.(USER_ACCESS_TOKEN_KEY);
    if (sessionToken) return sessionToken;

    const localToken = window.localStorage?.getItem?.(USER_ACCESS_TOKEN_KEY);
    if (localToken) return localToken;
  }

  return null;
};

const buildAuthHeaders = () => {
  const headers = {
    Accept: 'application/json'
  };

  const token = resolveAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const normalizeCoordinates = ({ x, y, coordinates }) => {
  const hasXY = Number.isFinite(x) && Number.isFinite(y);
  if (hasXY) return { x, y };

  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const [lat, lng] = coordinates.map((value) => Number(value));
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return convertLngLatToUtm32640({ lng, lat });
    }
  }

  throw new Error('مختصات مقصد برای ذخیره معتبر نیست');
};

export const createDestination = async ({
  title,
  description,
  x,
  y,
  coordinates,
  floor = null,
  source = 'manual',
  sourceId = null,
  tags = [],
  address = '',
  metadata = {}
} = {}) => {
  const resolvedTitle = title?.trim();
  if (!resolvedTitle) {
    throw new Error('عنوان مقصد الزامی است');
  }

  const { x: resolvedX, y: resolvedY } = normalizeCoordinates({ x, y, coordinates });
  const resolvedFloor = Number.isFinite(floor) ? Number(floor) : null;
  const resolvedTags = Array.isArray(tags) ? tags.filter(Boolean) : [];

  const payload = {
    title: resolvedTitle,
    x: resolvedX,
    y: resolvedY,
    floor: resolvedFloor,
    source,
    source_id: sourceId ?? null,
    tags: resolvedTags,
    address: address || '',
    metadata: metadata || {}
  };

  if (description) {
    payload.description = description;
  }

  const headers = {
    ...buildAuthHeaders(),
    'Content-Type': 'application/json'
  };

  const response = await fetch(appConfig.destinationsUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to save destination');
  }

  return data?.destination || data;
};

export default createDestination;

export const listDestinations = async ({
  page = 1,
  pageSize = 20,
  query,
  source,
  tag,
  signal
} = {}) => {
  const searchParams = new URLSearchParams();

  if (page) searchParams.append('page', page);
  if (pageSize) searchParams.append('page_size', pageSize);
  if (query) searchParams.append('q', query);
  if (source) searchParams.append('source', source);
  if (tag) searchParams.append('tag', tag);

  const requestUrl = `${appConfig.destinationsUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: buildAuthHeaders(),
    signal
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || 'Failed to load destinations');
  }

  return {
    items: data?.items || [],
    pagination: data?.pagination || null
  };
};
