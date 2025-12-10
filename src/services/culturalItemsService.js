import appConfig from '../config/appConfig';
import { ADMIN_ACCESS_TOKEN_KEY } from './adminAuthService';

const CULTURAL_ITEMS_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/cultural-items`;

const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

const buildAuthHeaders = () => {
  const accessToken = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  return {
    ...DEFAULT_HEADERS,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Request failed');
  }
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

const normalizeLocation = (location) => {
  if (!location) return null;

  const { x, y, floor, lng, lat } = location;

  return {
    lng: x ?? lng ?? null,
    lat: y ?? lat ?? null,
    floor: floor ?? null
  };
};

const normalizeCulturalItem = (item) => ({
  ...item,
  title: item.title ?? item.titles?.fa ?? null,
  description: item.description ?? item.descriptions?.fa ?? null,
  location: normalizeLocation(item.location)
});

export const fetchCulturalItems = async ({ page, pageSize, search, language = 'fa' }) => {
  const params = new URLSearchParams({
    language,
    page: String(page),
    pageSize: String(pageSize)
  });

  if (search) params.set('search', search);

  const response = await fetch(`${CULTURAL_ITEMS_BASE_URL}?${params.toString()}`, {
    headers: buildAuthHeaders()
  });
  const data = await handleResponse(response);

  return {
    ...data,
    items: (data.items || []).map(normalizeCulturalItem)
  };
};

export const fetchCulturalItemDetails = async (id) => {
  const response = await fetch(`${CULTURAL_ITEMS_BASE_URL}/${id}`, {
    headers: buildAuthHeaders()
  });
  const item = await handleResponse(response);
  return normalizeCulturalItem(item);
};

export const createCulturalItem = async (payload) => {
  const response = await fetch(CULTURAL_ITEMS_BASE_URL, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
};

export const updateCulturalItem = async (id, payload) => {
  const response = await fetch(`${CULTURAL_ITEMS_BASE_URL}/${id}`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
};

export const deleteCulturalItem = async (id) => {
  const response = await fetch(`${CULTURAL_ITEMS_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders()
  });
  return handleResponse(response);
};

export const fetchCulturalItemTranslations = async (id, targetLangs = 'en,ar,ur') => {
  const response = await fetch(`${CULTURAL_ITEMS_BASE_URL}/${id}/translations?targetLangs=${targetLangs}`, {
    headers: buildAuthHeaders()
  });
  return handleResponse(response);
};

export const createCulturalItemTranslation = async (id, payload) => {
  const response = await fetch(`${CULTURAL_ITEMS_BASE_URL}/${id}/translations`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
};

export const upsertCulturalItemTranslation = async (id, lang, payload) => {
  const response = await fetch(`${CULTURAL_ITEMS_BASE_URL}/${id}/translations/${lang}`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
};

export const exportCulturalItems = ({ language = 'fa', search } = {}) => {
  const params = new URLSearchParams({ language });
  if (search) params.set('search', search);
  const url = `${CULTURAL_ITEMS_BASE_URL}/export?${params.toString()}`;
  window.open(url, '_blank');
};
