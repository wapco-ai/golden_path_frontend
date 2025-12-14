import appConfig from '../config/appConfig.js';
import { ADMIN_ACCESS_TOKEN_KEY } from './adminAuthService.js';

const TEMP_BLOCK_AREA_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/admin/temp-block-areas`;

const buildAuthHeaders = () => {
  const accessToken = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
};

const handleResponse = async (response, fallbackMessage) => {
  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.message || fallbackMessage);
  }

  return data;
};

export const createTempBlockArea = async (payload, { signal } = {}) => {
  const response = await fetch(TEMP_BLOCK_AREA_BASE_URL, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  return handleResponse(response, 'ثبت محدوده موقت ناموفق بود');
};

export default createTempBlockArea;
