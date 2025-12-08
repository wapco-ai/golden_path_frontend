import appConfig from '../config/appConfig.js';
import { ADMIN_ACCESS_TOKEN_KEY } from './adminAuthService.js';

const DOORS_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/doors`;

const buildAuthHeaders = () => {
  const accessToken = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
};

export const createDoor = async ({
  x,
  y,
  floor,
  allowed_gender = 'both',
  is_open = true,
  modes = ['walk',
    'wheelchair'],
  bidirectional = true,
  signal
}) => {
  const response = await fetch(DOORS_BASE_URL, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      x,
      y,
      floor,
      allowed_gender,
      is_open,
      modes,
      bidirectional
    }),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'ثبت درب جدید ناموفق بود');
  }

  return data;
};

export const getDoorInfo = async (id, { signal } = {}) => {
  const response = await fetch(`${DOORS_BASE_URL}/${id}/info`, {
    method: 'GET',
    headers: buildAuthHeaders(),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'دریافت اطلاعات درب ناموفق بود');
  }

  return data;
};

export const updateDoorInfo = async (id, payload, { signal } = {}) => {
  const response = await fetch(`${DOORS_BASE_URL}/${id}/info`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'ثبت اطلاعات درب ناموفق بود');
  }

  return data;
};

export const moveDoor = async (id, { x, y, floor }, { signal } = {}) => {
  const response = await fetch(`${DOORS_BASE_URL}/${id}/move`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify({ x, y, floor }),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'جابجایی درب ناموفق بود');
  }

  return data;
};

export const deleteDoor = async (id, { signal } = {}) => {
  const response = await fetch(`${DOORS_BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'حذف درب ناموفق بود');
  }

  return data;
};

export default createDoor;
