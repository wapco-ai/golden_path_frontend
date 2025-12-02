import appConfig from '../config/appConfig.js';

export const fetchAreaDoors = async ({ lat, lon, floor, lang, signal }) => {
  const url = new URL(`${appConfig.apiBaseUrl}/api/v1/area-doors`);

  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lon);
  url.searchParams.set('floor', floor);

  if (lang) {
    url.searchParams.set('lang', lang);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    },
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || `area-doors request failed with status ${response.status}`);
  }

  return data;
};

export default fetchAreaDoors;
