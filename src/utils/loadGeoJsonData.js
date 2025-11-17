import { buildGeoJsonPath } from './geojsonPath.js';

const DEFAULT_FLOOR = 0;

export async function loadGeoJsonData({ language = 'fa', floor = DEFAULT_FLOOR, signal } = {}) {
  const file = buildGeoJsonPath(language);

  try {
    const response = await fetch(file, { signal });
    if (!response.ok) {
      throw new Error(`GeoJSON file request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.error('failed to load geojson file', error);
    throw error;
  }
}

export default loadGeoJsonData;
