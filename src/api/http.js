import axios from 'axios';
import appConfig from '../config/appConfig';

const getAdminToken = () => {
  if (typeof window === 'undefined') return null;

  const sessionToken = sessionStorage.getItem('gp_admin_access_token');
  if (sessionToken) return sessionToken;

  const directToken = localStorage.getItem('admin_access_token');
  if (directToken) return directToken;

  const adminStoreRaw = localStorage.getItem('gp_admin_auth_store');
  if (adminStoreRaw) {
    try {
      const parsed = JSON.parse(adminStoreRaw);
      const accessToken = parsed?.state?.accessToken;
      if (accessToken) return accessToken;
    } catch (error) {
      // Ignore malformed admin store payloads
    }
  }

  const adminSessionRaw = localStorage.getItem('adminSession');
  if (!adminSessionRaw) return null;

  try {
    const parsed = JSON.parse(adminSessionRaw);
    return parsed?.accessToken || parsed?.token || parsed?.access_token || null;
  } catch (error) {
    return null;
  }
};

const redirectToAdminLogin = () => {
  if (typeof window === 'undefined') return;

  const loginHashPath = '#/admin/login';

  // Ensure we stay within the HashRouter context to avoid dropping the main app shell
  if (window.location.hash === loginHashPath) return;

  window.location.hash = loginHashPath;
};

const http = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  },
  validateStatus: (status) => status >= 200 && status < 300
});

http.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token && !config?.headers?.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      redirectToAdminLogin();
    }
    return Promise.reject(error);
  }
);

export { getAdminToken };
export default http;
