const inferHostedBaseUrl = () => {
  if (typeof window === 'undefined' || !window?.location?.origin) {
    return null;
  }

  const { origin, hostname } = window.location;

  // When running the PWA from a production host we want to hit the same origin.
  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return origin;
  }

  return null;
};

const inferHostedTileBaseUrl = () => {
  if (typeof window === 'undefined' || !window?.location?.origin) {
    return 'http://localhost:8080/tiles';
  }

  const { origin, hostname } = window.location;

  if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${origin.replace(/\/$/, '')}/tiles`;
  }

  return 'http://localhost:8080/tiles';
};

const defaultApiBaseUrl = inferHostedBaseUrl() || 'http://localhost:8080';
const defaultTileBaseUrl = inferHostedTileBaseUrl();
const defaultRoutingRouteUrl = `${defaultApiBaseUrl}/api/v1/routing/route`;
const defaultLanguagesUrl = `${defaultApiBaseUrl}/api/v1/languages`;
const defaultLandmarkPlacesUrl = `${defaultApiBaseUrl}/api/v1/landmark-places`;
const defaultGroupMetadataUrl = `${defaultApiBaseUrl}/api/v1/groups/metadata`;
const defaultGroupSubGroupsUrl = `${defaultApiBaseUrl}/api/v1/groups/subgroups`;
const defaultUserFeedbackUrl = `${defaultApiBaseUrl}/api/v1/feedbacks`;

const appConfig = {
  apiBaseUrl: (import.meta?.env?.VITE_API_BASE_URL?.trim() || defaultApiBaseUrl).replace(/\/$/, ''),
  tileBaseUrl: (import.meta?.env?.VITE_TILE_BASE_URL?.trim() || defaultTileBaseUrl).replace(/\/$/, ''),
  routingRouteUrl: (import.meta?.env?.VITE_ROUTING_ROUTE_URL?.trim() || defaultRoutingRouteUrl).replace(/\/$/, ''),
  languagesUrl: (import.meta?.env?.VITE_LANGUAGES_URL?.trim() || defaultLanguagesUrl).replace(/\/$/, ''),
  landmarkPlacesUrl: (import.meta?.env?.VITE_LANDMARK_PLACES_URL?.trim() || defaultLandmarkPlacesUrl).replace(/\/$/, ''),
  groupMetadataUrl: (import.meta?.env?.VITE_GROUP_METADATA_URL?.trim() || defaultGroupMetadataUrl).replace(/\/$/, ''),
  groupSubGroupsUrl: (import.meta?.env?.VITE_GROUP_SUBGROUPS_URL?.trim() || defaultGroupSubGroupsUrl).replace(/\/$/, ''),
  userFeedbackUrl: (import.meta?.env?.VITE_USER_FEEDBACK_URL?.trim() || defaultUserFeedbackUrl).replace(/\/$/, ''),
  terrainProbeUrl: import.meta?.env?.VITE_TERRAIN_PROBE_URL?.trim() || 'https://demotiles.maplibre.org/terrain-tiles/tiles/0/0/0.png',
  googleMapsDirectionsBaseUrl: import.meta?.env?.VITE_GOOGLE_MAPS_DIRECTIONS_BASE_URL?.trim() || 'https://www.google.com/maps/dir/',
  ttsAuthUrl: import.meta?.env?.VITE_TTS_AUTH_URL?.trim() || 'https://api.aipaa.ir/auth/token/',
  ttsRequestUrl: import.meta?.env?.VITE_TTS_REQUEST_URL?.trim() || 'https://api.aipaa.ir/api/v1/voice/tts-file-response/?expire-file=yes',
  shrineEventsBaseUrl: import.meta?.env?.VITE_SHRINE_EVENTS_BASE_URL?.trim() || 'http://localhost:8080/api/v1/kouthar/',
  doorBoundaryToleranceMeters: Number(import.meta?.env?.VITE_DOOR_BOUNDARY_TOLERANCE ?? '') || 4
};

export default appConfig;
