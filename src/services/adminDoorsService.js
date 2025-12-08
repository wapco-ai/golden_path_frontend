import appConfig from '../config/appConfig.js';
import { ADMIN_ACCESS_TOKEN_KEY } from './adminAuthService.js';

const DOORS_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/doors`;

export const createDoor = async ({
  x,
  y,
  floor,
  allowed_gender = 'both',
  is_open = true,
  modes = ['walk', 'wheelchair'],
  bidirectional = true,
  signal
}) => {
  const accessToken = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  const response = await fetch(DOORS_BASE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
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

export default createDoor;
