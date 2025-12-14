import appConfig from '../config/appConfig.js';
import { ADMIN_ACCESS_TOKEN_KEY } from './adminAuthService.js';

const VAN_ADMIN_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/admin/van`;

const buildAuthHeaders = () => {
  const accessToken = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
};

const handleResponse = async (response, fallbackMessage) => {
  let data = {};

  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data?.message || fallbackMessage);
  }

  return data;
};

export const createVanNode = async (payload, { signal } = {}) => {
  const response = await fetch(`${VAN_ADMIN_BASE_URL}/nodes`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  return handleResponse(response, 'ثبت نقطه ون ناموفق بود');
};

export const createVanEdge = async (payload, { signal } = {}) => {
  const response = await fetch(`${VAN_ADMIN_BASE_URL}/edges`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  return handleResponse(response, 'ثبت مسیر ون ناموفق بود');
};

export default createVanNode;
