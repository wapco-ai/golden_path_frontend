import axios from 'axios';
import appConfig from '../config/appConfig';
import { useAdminAuthStore } from '../auth/admin/adminAuthStore';

const apiAdmin = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: {
    Accept: 'application/json'
  },
  validateStatus: (status) => status >= 200 && status < 300
});

apiAdmin.interceptors.request.use((config) => {
  const { accessToken } = useAdminAuthStore.getState();
  if (accessToken && !config?.headers?.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise = null;
let hasRedirectedToAdminLogin = false;

const redirectToAdminLogin = () => {
  if (typeof window === 'undefined' || hasRedirectedToAdminLogin) return;
  hasRedirectedToAdminLogin = true;
  window.location.assign('/admin/login');
};

apiAdmin.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};

    if (status !== 401 || originalRequest._adminRetry) {
      return Promise.reject(error);
    }

    const store = useAdminAuthStore.getState();
    if (!store.refreshToken) {
      store.clearAuth();
      redirectToAdminLogin();
      return Promise.reject(error);
    }

    if (!refreshPromise) {
      refreshPromise = store
        .refreshSession()
        .catch((refreshError) => {
          store.clearAuth();
          redirectToAdminLogin();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      const { accessToken } = await refreshPromise;
      originalRequest._adminRetry = true;
      originalRequest.headers = originalRequest.headers || {};
      if (accessToken) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }
      return apiAdmin(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default apiAdmin;
