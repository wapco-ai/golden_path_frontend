import appConfig from '../config/appConfig.js';

import { resolveMediaUrl } from '../utils/locationMedia.js';

const resolveImageSource = (image) => {
  const url = resolveMediaUrl(image, { apiBaseUrl: appConfig.apiBaseUrl });
  if (!url || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url)) return url;
  return new URL(url, appConfig.apiBaseUrl + '/').href;
};

export const fetchLandmarkViewImage = async ({
  language = 'fa',
  geo,
  heading,
  floor = 0,
  fov = 60,
  maxDistance = 800,
  source = 'auto',
  signal
} = {}) => {
  if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) {
    throw new Error('Valid geo coordinates are required to fetch landmark view image.');
  }

  if (!Number.isFinite(heading)) {
    throw new Error('A numeric heading is required to fetch landmark view image.');
  }

  if (!['auto', 'guidance_points'].includes(source)) {
    throw new Error('Unsupported navigation image source.');
  }

  const params = new URLSearchParams();
  params.set('language', language || 'fa');
  params.set('geo[lat]', geo.lat);
  params.set('geo[lng]', geo.lng);
  params.set('heading', heading);
  params.set('floor', floor);
  params.set('fov', fov);
  params.set('max_distance', maxDistance);
  if (source === 'guidance_points') params.set('source', source);

  const requestUrl = `${appConfig.landmarkViewImageUrl}?${params.toString()}`;
  const response = await fetch(requestUrl, {
    headers: { Accept: 'application/json' },
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch landmark view image: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Older servers may ignore source. Fail closed rather than silently showing POI imagery.
  if (source === 'guidance_points' && data?.source !== 'guidance_points') {
    throw new Error('Backend does not support guidance-only images. Update the backend first.');
  }

  const imageUrl = resolveImageSource(data?.image);
  if (imageUrl) {
    data.image = {
      ...(typeof data.image === 'object' ? data.image : {}),
      url: imageUrl
    };
  }

  return data;
};

export default fetchLandmarkViewImage;
