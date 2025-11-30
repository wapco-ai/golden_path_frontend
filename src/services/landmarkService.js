import appConfig from '../config/appConfig.js';

const sanitizeLimit = (limit) => {
  const numericLimit = Number(limit);

  if (Number.isNaN(numericLimit)) return 20;

  return Math.min(Math.max(Math.floor(numericLimit), 1), 200);
};

export const fetchLandmarkPlaces = async ({ language = 'fa', limit = 20, geo } = {}) => {
  const baseUrl = appConfig.apiBaseUrl.replace(/\/$/, '');
  const url = `${baseUrl}/api/v1/landmark-places`;

  const params = new URLSearchParams();
  params.set('language', language || 'fa');
  params.set('limit', sanitizeLimit(limit));

  if (geo?.lat != null && geo?.lng != null) {
    params.set('geo[lat]', geo.lat);
    params.set('geo[lng]', geo.lng);
  }

  const response = await fetch(`${url}?${params.toString()}`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch landmark places: ${response.status} ${errorText}`);
  }

  return response.json();
};

export default fetchLandmarkPlaces;
