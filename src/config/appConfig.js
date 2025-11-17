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

const defaultApiBaseUrl = inferHostedBaseUrl() || 'http://localhost:8080';

const appConfig = {
  apiBaseUrl: import.meta?.env?.VITE_API_BASE_URL?.trim() || defaultApiBaseUrl,
  doorBoundaryToleranceMeters: Number(import.meta?.env?.VITE_DOOR_BOUNDARY_TOLERANCE ?? '') || 4
};

export default appConfig;
