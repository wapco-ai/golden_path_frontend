import appConfig from '../config/appConfig';

const normalizeMediaUrl = (value) => {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.includes('://') || trimmed.startsWith('//')) return trimmed;

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed.replace(/^\.\//, '')}`;
  return `${appConfig.apiBaseUrl}${normalizedPath}`;
};

const resolveImageSource = (image) => {
  if (!image) return null;

  if (typeof image === 'string') {
    return normalizeMediaUrl(image);
  }

  if (typeof image !== 'object') {
    return null;
  }

  if (image.url) {
    return normalizeMediaUrl(image.url) || image.url;
  }

  if (image.path) {
    return normalizeMediaUrl(image.path);
  }

  if (typeof image.data === 'string' && image.data.trim()) {
    const mime = image.mime || 'image/jpeg';
    const normalizedBase64 = image.data
      .trim()
      .replace(/^data:[^;]+;base64,/, '');

    return `data:${mime};base64,${normalizedBase64}`;
  }

  return null;
};

export const fetchLandmarkViewImage = async ({
  language = 'fa',
  geo,
  heading,
  floor = 0,
  fov = 90,
  maxDistance = 800,
  signal
} = {}) => {
  if (!geo || !Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) {
    throw new Error('Valid geo coordinates are required to fetch landmark view image.');
  }

  if (!Number.isFinite(heading)) {
    throw new Error('A numeric heading is required to fetch landmark view image.');
  }

  const params = new URLSearchParams();
  params.set('language', language || 'fa');
  params.set('geo[lat]', geo.lat);
  params.set('geo[lng]', geo.lng);
  params.set('heading', heading);
  params.set('floor', floor);
  params.set('fov', fov);
  params.set('max_distance', maxDistance);

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
