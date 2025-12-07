import appConfig from '../config/appConfig.js';

export const ADMIN_ACCESS_TOKEN_KEY = 'gp_admin_access';
export const ADMIN_REFRESH_TOKEN_KEY = 'gp_admin_refresh';

const AUTH_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/admin/auth`;

const storeTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) {
    sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);
  }
};

export const clearTokens = () => {
  sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
};

export const loginAdmin = async ({ usernameOrEmail, password, signal }) => {
  const response = await fetch(`${AUTH_BASE_URL}/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ usernameOrEmail, password }),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'خطا در ورود ادمین');
  }

  storeTokens({ accessToken: data?.accessToken, refreshToken: data?.refreshToken });

  return data;
};

export const refreshAdminSession = async ({ refreshToken, signal }) => {
  const token = refreshToken || localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);

  if (!token) {
    throw new Error('Refresh token موجود نیست');
  }

  const response = await fetch(`${AUTH_BASE_URL}/refresh`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken: token }),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'بازیابی نشست ناموفق بود');
  }

  storeTokens({ accessToken: data?.accessToken, refreshToken: data?.refreshToken });

  return data;
};

export const fetchCurrentAdmin = async ({ accessToken, signal }) => {
  const token = accessToken || sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  if (!token) {
    throw new Error('Access token موجود نیست');
  }

  const response = await fetch(`${AUTH_BASE_URL}/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'دریافت پروفایل ادمین ناموفق بود');
  }

  return data;
};

export const logoutAdmin = async ({ accessToken, refreshToken, signal }) => {
  const activeAccessToken = accessToken || sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
  const activeRefreshToken = refreshToken || localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);

  if (!activeAccessToken || !activeRefreshToken) {
    clearTokens();
    return { message: 'tokens_already_cleared' };
  }

  const response = await fetch(`${AUTH_BASE_URL}/logout`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeAccessToken}`
    },
    body: JSON.stringify({ refreshToken: activeRefreshToken }),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'خروج ناموفق بود');
  }

  clearTokens();
  return data;
};

export default loginAdmin;
