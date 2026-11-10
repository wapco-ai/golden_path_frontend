import appConfig from '../config/appConfig.js';

export const fetchAreaDoors = async ({ areaGroupId, areaId, lat, lon, floor, lang, mode, gender, signal }) => {
  const url = new URL(`${appConfig.apiBaseUrl}/api/v1/area-doors`);

  if (areaGroupId != null) {
    url.searchParams.set('area_group_id', areaGroupId);
  } else if (areaId != null) {
    url.searchParams.set('area_id', areaId);
  } else {
    url.searchParams.set('lat', lat);
    url.searchParams.set('lon', lon);
  }
  url.searchParams.set('floor', floor);

  if (lang) {
    url.searchParams.set('lang', lang);
  }

  if (mode) url.searchParams.set('mode', mode);
  if (gender) url.searchParams.set('gender', gender);

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
