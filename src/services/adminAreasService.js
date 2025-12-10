import appConfig from '../config/appConfig.js';
import { ADMIN_ACCESS_TOKEN_KEY } from './adminAuthService.js';

const AREAS_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/areas`;

const buildAuthHeaders = () => {
  const accessToken = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
};

export const createArea = async (payload, { signal } = {}) => {
  const response = await fetch(AREAS_BASE_URL, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'ثبت محدوده جدید ناموفق بود');
  }

  return data;
};

export const getAreaInfo = async (id, { signal } = {}) => {
  const response = await fetch(`${AREAS_BASE_URL}/${id}/info`, {
    method: 'GET',
    headers: buildAuthHeaders(),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'دریافت اطلاعات محدوده ناموفق بود');
  }

  return data;
};

export const updateAreaInfo = async (id, payload, { signal } = {}) => {
  const response = await fetch(`${AREAS_BASE_URL}/${id}/info`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'ثبت اطلاعات محدوده ناموفق بود');
  }

  return data;
};

export const moveArea = async (id, payload, { signal } = {}) => {
  const response = await fetch(`${AREAS_BASE_URL}/${id}/move`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'جابجایی محدوده ناموفق بود');
  }

  return data;
};

export const deleteArea = async (id, { signal } = {}) => {
  const response = await fetch(`${AREAS_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'حذف محدوده ناموفق بود');
  }

  return data;
};

export default createArea;
