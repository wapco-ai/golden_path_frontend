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

export const updateTempBlockArea = async (id, payload, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await fetch(`${TEMP_BLOCK_AREA_BASE_URL}/${id}`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  return handleResponse(response, 'به‌روزرسانی محدوده موقت ناموفق بود');
};

export const getTempBlockArea = async (id, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await fetch(`${TEMP_BLOCK_AREA_BASE_URL}/${id}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
    signal
  });

  return handleResponse(response, 'دریافت اطلاعات محدوده موقت ناموفق بود');
};

export const deleteTempBlockArea = async (id, { signal } = {}) => {
  const response = await fetch(`${TEMP_BLOCK_AREA_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
    signal
  });
  return handleResponse(response, 'حذف محدوده موقت ناموفق بود');
};

export const stopTempBlockArea = async (id, payload = {}, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await fetch(`${TEMP_BLOCK_AREA_BASE_URL}/${id}/stop`, {
    method: 'PATCH',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  return handleResponse(response, 'توقف محدوده موقت ناموفق بود');
};

export const extendTempBlockArea = async (id, payload = {}, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await fetch(`${TEMP_BLOCK_AREA_BASE_URL}/${id}/extend`, {
    method: 'PATCH',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  return handleResponse(response, 'تمدید محدوده موقت ناموفق بود');
};

export default createTempBlockArea;
