import { getPointFloor } from './floors.js';
import { validGeo } from './locationQuality.js';

// Search/display POIs only. Never used to construct routing edges.
export function placesToFeatures(places = [], floor, address = () => '') {
  return { type: 'FeatureCollection', features: (Array.isArray(places) ? places : []).flatMap(place => {
    const lat = place.lat ?? place.latitude ?? place.location?.lat ?? place.geo?.lat
      ?? place.coordinates?.[0] ?? place.geometry?.coordinates?.[1];
    const lng = place.lng ?? place.longitude ?? place.location?.lng ?? place.geo?.lng
      ?? place.coordinates?.[1] ?? place.geometry?.coordinates?.[0];
    const position = { lat: Number(lat), lng: Number(lng) };
    if (lat == null || lng == null || !validGeo(position) || getPointFloor(place) !== Number(floor)) return [];
    return [{ type: 'Feature', id: place.id ?? place.poiId ?? place.poi_id,
      geometry: { type: 'Point', coordinates: [position.lng, position.lat] },
      properties: { ...place, name: place.title || place.name || '', subGroup: address(place),
        floor: getPointFloor(place), group: place.group || 'other' } }];
  }) };
}
