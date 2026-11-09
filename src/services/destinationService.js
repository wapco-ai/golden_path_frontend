import { userRequest } from '../api/userRequest.js';
import appConfig from '../config/appConfig.js';
import { convertLngLatToUtm32640 } from '../utils/utm.js';
import { getSessionFloor } from '../utils/sessionFloor.js';

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

const normalizeFloor = (floor) => {
  if (floor !== null && floor !== undefined && floor !== '') {
    const parsed = Number(floor);
    if (Number.isFinite(parsed)) return parsed;
  }

  return Number(getSessionFloor());
};

const parseResponse = async (response, fallbackMessage) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || fallbackMessage);
  }

  return data;
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
  const resolvedFloor = normalizeFloor(floor);
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

    'Content-Type': 'application/json'
  };

  const response = await userRequest(appConfig.destinationsUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await parseResponse(response, 'Failed to save destination');
  return data?.destination || data;
};

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

  const response = await userRequest(requestUrl, {
    method: 'GET',

    signal
  });

  const data = await parseResponse(response, 'Failed to load destinations');

  return {
    items: data?.items || [],
    pagination: data?.pagination || null
  };
};

export const updateDestination = async (destinationId, {
  title,
  description,
  tags,
  address,
  metadata
} = {}) => {
  if (destinationId == null) {
    throw new Error('شناسه مقصد معتبر نیست');
  }

  const payload = {};

  if (typeof title === 'string') {
    const resolvedTitle = title.trim();
    if (!resolvedTitle) {
      throw new Error('عنوان مقصد الزامی است');
    }
    payload.title = resolvedTitle;
  }

  if (typeof description === 'string') payload.description = description.trim();
  if (Array.isArray(tags)) payload.tags = tags.filter(Boolean);
  if (typeof address === 'string') payload.address = address;
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) payload.metadata = metadata;

  const response = await userRequest(`${appConfig.destinationsUrl}/${destinationId}`, {
    method: 'PUT',
    headers: {

      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await parseResponse(response, 'Failed to update destination');
  return data?.destination || data;
};

export const deleteDestination = async (destinationId) => {
  if (destinationId == null) {
    throw new Error('شناسه مقصد معتبر نیست');
  }

  const response = await userRequest(`${appConfig.destinationsUrl}/${destinationId}`, {
    method: 'DELETE'
  });

  return parseResponse(response, 'Failed to delete destination');
};

export default createDestination;
