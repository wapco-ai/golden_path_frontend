import appConfig from '../config/appConfig.js';
import { normalizeRouteSnapshot } from './routingService.js';

const ACCESS_TOKEN_KEY = 'gp_user_access_token';

export const historyModeToTransportMode = (mode) => {
  if (mode === 'wheelchair') return 'wheelchair';
  if (mode === 'van' || mode === 'electric-car') return 'electric-car';
  return 'walking';
};

export const historyModeMessageId = (mode) => {
  if (mode === 'wheelchair') return 'transportWheelchair';
  if (mode === 'van' || mode === 'electric-car') return 'transportCar';
  return 'transportWalk';
};

export const fetchRouteHistory = async ({ limit = 20, signal } = {}) => {
  const token = typeof sessionStorage !== 'undefined'
    ? sessionStorage.getItem(ACCESS_TOKEN_KEY)
    : null;

  if (!token) {
    return [];
  }

  const response = await fetch(`${appConfig.apiBaseUrl}/api/v1/users/me/route-history?limit=${encodeURIComponent(limit)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Route history request failed: ${response.status} ${errorText}`);
    error.status = response.status;
    throw error;
  }

  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
};

export const normalizeHistoryRoute = (historyItem) => {
  if (!historyItem?.route || !historyItem?.origin || !historyItem?.destination) {
    return null;
  }

  return normalizeRouteSnapshot(
    historyItem.route,
    historyItem.origin,
    historyItem.destination,
    historyItem.mode || 'walk',
    historyItem.gender || 'both'
  );
};
