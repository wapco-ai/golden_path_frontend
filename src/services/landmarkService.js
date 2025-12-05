import appConfig from '../config/appConfig.js';

export const fetchLandmarkPlaces = async ({ language = 'fa', geo, poiId } = {}) => {
  const url = appConfig.landmarkPlacesUrl;

  const params = new URLSearchParams();
  params.set('language', language || 'fa');

  if (poiId != null) {
    params.set('poi_id', poiId);
  }

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
