import axios from 'axios';
import appConfig from '../config/appConfig';

const getAdminToken = () => {
  if (typeof window === 'undefined') return null;

  const directToken = localStorage.getItem('admin_access_token');
  if (directToken) return directToken;

  const adminSessionRaw = localStorage.getItem('adminSession');
  if (!adminSessionRaw) return null;

  try {
    const parsed = JSON.parse(adminSessionRaw);
    return parsed?.accessToken || parsed?.token || parsed?.access_token || null;
  } catch (error) {
    return null;
  }
};

const http = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
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
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export { getAdminToken };
export default http;
