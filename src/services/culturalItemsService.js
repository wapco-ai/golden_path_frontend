const DEFAULT_HEADERS = {
  'Content-Type': 'application/json'
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

export const fetchCulturalItems = async ({ page, pageSize, search, language = 'fa' }) => {
  const params = new URLSearchParams({
    language,
    page: String(page),
    pageSize: String(pageSize)
  });

  if (search) params.set('search', search);

  const response = await fetch(`/api/v1/cultural-items?${params.toString()}`);
  return handleResponse(response);
};

export const fetchCulturalItemDetails = async (id) => {
  const response = await fetch(`/api/v1/cultural-items/${id}`);
  return handleResponse(response);
};

export const createCulturalItem = async (payload) => {
  const response = await fetch('/api/v1/cultural-items', {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
};

export const updateCulturalItem = async (id, payload) => {
  const response = await fetch(`/api/v1/cultural-items/${id}`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
};

export const deleteCulturalItem = async (id) => {
  const response = await fetch(`/api/v1/cultural-items/${id}`, {
    method: 'DELETE'
  });
  return handleResponse(response);
};

export const fetchCulturalItemTranslations = async (id, targetLangs = 'en,ar,ur') => {
  const response = await fetch(`/api/v1/cultural-items/${id}/translations?targetLangs=${targetLangs}`);
  return handleResponse(response);
};

export const createCulturalItemTranslation = async (id, payload) => {
  const response = await fetch(`/api/v1/cultural-items/${id}/translations`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
};

export const upsertCulturalItemTranslation = async (id, lang, payload) => {
  const response = await fetch(`/api/v1/cultural-items/${id}/translations/${lang}`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(payload)
  });
  return handleResponse(response);
};

export const exportCulturalItems = ({ language = 'fa', search } = {}) => {
  const params = new URLSearchParams({ language });
  if (search) params.set('search', search);
  const url = `/api/v1/cultural-items/export?${params.toString()}`;
  window.open(url, '_blank');
};
