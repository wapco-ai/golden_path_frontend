import appConfig from '../config/appConfig';
import { USER_ACCESS_TOKEN_KEY, useUserAuthStore } from '../auth/user/userAuthStore';

const resolveAccessToken = () => {
  const storeToken = useUserAuthStore.getState().accessToken;
  if (storeToken) return storeToken;

  if (typeof window !== 'undefined') {
    return window.sessionStorage?.getItem?.(USER_ACCESS_TOKEN_KEY) || null;
  }

  return null;
};

const authHeaders = (withJson = false) => {
  const token = resolveAccessToken();
  const headers = { Accept: 'application/json' };
  if (withJson) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || 'Location share request failed');
    error.code = data?.code || null;
    error.status = response.status;
    throw error;
  }
  return data;
};

export const createLocationShare = async ({ recipientPhone, lat, lng, floor, accuracyM }) => {
  const response = await fetch(appConfig.locationSharesUrl, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify({ recipientPhone, lat, lng, floor, accuracyM })
  });

  const data = await parseResponse(response);
  return data?.share || data;
};

export const listIncomingLocationShares = async () => {
  const response = await fetch(`${appConfig.locationSharesUrl}/incoming`, {
    headers: authHeaders()
  });
  const data = await parseResponse(response);
  return Array.isArray(data?.items) ? data.items : [];
};

export const listOutgoingLocationShares = async () => {
  const response = await fetch(`${appConfig.locationSharesUrl}/outgoing`, {
    headers: authHeaders()
  });
  const data = await parseResponse(response);
  return Array.isArray(data?.items) ? data.items : [];
};

export const revokeLocationShare = async (id) => {
  const response = await fetch(`${appConfig.locationSharesUrl}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return parseResponse(response);
};
