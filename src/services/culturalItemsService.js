import { convertUtm32640ToLngLat } from '../utils/utm';
import apiAdmin from '../api/apiAdmin';

const CULTURAL_ITEMS_BASE_URL = '/api/v1/cultural-items';

const buildMediaUrl = (media, defaultMime = 'image/jpeg') => {
  if (!media) return null;

  if (typeof media === 'string') {
    const trimmed = media.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) return trimmed;

    const normalized = trimmed.replace(/\s+/g, '');
    const isRawBase64 = /^[A-Za-z0-9+/]+={0,2}$/g.test(normalized);
    if (isRawBase64) {
      return `data:${defaultMime};base64,${normalized}`;
    }

    return trimmed;
  }

  if (typeof media === 'object') {
    if (media.url) return buildMediaUrl(media.url, media.mime || defaultMime);
    if (media.path) return buildMediaUrl(media.path, media.mime || defaultMime);
    if (media.data) {
      return `data:${media.mime || defaultMime};base64,${media.data}`;
    }
  }

  return null;
};

const resolvePrimaryImage = (item) => {
  if (!item) return null;

  const directPrimary = item.primaryImage ?? item.primary_image ?? null;
  if (directPrimary) {
    return buildMediaUrl(directPrimary);
  }

  const mediaList = Array.isArray(item.media)
    ? item.media
    : Array.isArray(item.media?.fa)
      ? item.media.fa
      : [];

  if (!mediaList.length) return null;

  const preferred = mediaList.find((media) => (
    media?.isPrimary || media?.is_primary || media?.primary
  ));

  const fallback = preferred ?? mediaList[0];
  const mimeType = fallback?.mime || fallback?.type || 'image/jpeg';
  return buildMediaUrl(fallback, mimeType);
};

const normalizeLocation = (location) => {
  if (!location) return null;

  const { x, y, floor, lng, lat } = location;

  if (typeof x === 'number' && typeof y === 'number') {
    const { lng: convertedLng, lat: convertedLat } = convertUtm32640ToLngLat({ x, y });
    return {
      lng: convertedLng,
      lat: convertedLat,
      floor: floor ?? null
    };
  }

  return {
    lng: lng ?? null,
    lat: lat ?? null,
    floor: floor ?? null
  };
};

const normalizeCulturalItem = (item) => {
  const normalizedId = item.id ?? item.poiId ?? item.poi_id ?? null;
  const resolvedPrimaryImage = resolvePrimaryImage(item);

  return {
    ...item,
    id: normalizedId,
    poiId: item.poiId ?? item.poi_id ?? normalizedId,
    title: item.title ?? item.titles?.fa ?? null,
    description: item.description ?? item.descriptions?.fa ?? null,
    location: normalizeLocation(item.location),
    primaryImage: resolvedPrimaryImage ?? item.primaryImage ?? null
  };
};

export const fetchCulturalItems = async ({ page, pageSize, search, language = 'fa' }) => {
  const response = await apiAdmin.get(CULTURAL_ITEMS_BASE_URL, {
    params: {
      language,
      page,
      pageSize,
      ...(search ? { search } : {})
    }
  });
  const data = response.data;

  return {
    ...data,
    items: (data.items || []).map(normalizeCulturalItem)
  };
};

export const fetchCulturalItemDetails = async (id) => {
  const response = await apiAdmin.get(`${CULTURAL_ITEMS_BASE_URL}/${id}`);
  return normalizeCulturalItem(response.data);
};

export const createCulturalItem = async (payload) => {
  const response = await apiAdmin.post(CULTURAL_ITEMS_BASE_URL, payload);
  return response.data;
};

export const updateCulturalItem = async (id, payload) => {
  const response = await apiAdmin.put(`${CULTURAL_ITEMS_BASE_URL}/${id}`, payload);
  return response.data;
};

export const deleteCulturalItem = async (id) => {
  const response = await apiAdmin.delete(`${CULTURAL_ITEMS_BASE_URL}/${id}`);
  return response.data;
};

export const fetchCulturalItemTranslations = async (id, targetLangs = 'en,ar,ur') => {
  const response = await apiAdmin.get(`${CULTURAL_ITEMS_BASE_URL}/${id}/translations`, {
    params: { targetLangs }
  });
  return response.data;
};

export const createCulturalItemTranslation = async (id, payload) => {
  const response = await apiAdmin.post(`${CULTURAL_ITEMS_BASE_URL}/${id}/translations`, payload);
  return response.data;
};

export const upsertCulturalItemTranslation = async (id, lang, payload) => {
  const response = await apiAdmin.put(`${CULTURAL_ITEMS_BASE_URL}/${id}/translations/${lang}`, payload);
  return response.data;
};

export const exportCulturalItems = ({ language = 'fa', search } = {}) => {
  const params = new URLSearchParams({ language });
  if (search) params.set('search', search);
  const url = `${apiAdmin.defaults.baseURL}${CULTURAL_ITEMS_BASE_URL}/export?${params.toString()}`;
  window.open(url, '_blank');
};
