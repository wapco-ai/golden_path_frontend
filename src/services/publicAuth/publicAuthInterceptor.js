import axios from 'axios';
import publicApi from './publicApi';
import { clearTokens, getAccessToken, getRefreshToken, isAccessExpired, setTokens } from './publicTokenStore';
import { refresh as refreshSession } from './publicAuthClient';

let refreshPromise = null;

const isPublicRequest = (config) => {
  const url = config.url || '';
  return url.startsWith('/auth') || url.startsWith('/users');
};

export const setupPublicAuthInterceptor = ({ onLogout, onUnauthenticated } = {}) => {
  const attachAuth = (config) => {
    if (config?.skipAuth) return config;
    const token = getAccessToken();
    if (token && (!config.headers || !('Authorization' in config.headers))) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  };

  const handleError = async (error) => {
    const status = error?.response?.status;
    const originalRequest = error.config || {};

    if (!status || status !== 401 || originalRequest._publicRetry || originalRequest?.skipAuth || !isPublicRequest(originalRequest)) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      onUnauthenticated?.();
      return Promise.reject(error);
    }

    try {
      if (!refreshPromise) {
        refreshPromise = refreshSession({ refreshToken }).finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed?.accessToken && refreshed?.refreshToken && refreshed?.expiresIn) {
        setTokens({ accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken, expiresIn: refreshed.expiresIn });
      }
      originalRequest._publicRetry = true;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${getAccessToken()}`;
      return (originalRequest.baseURL ? axios : publicApi)(originalRequest);
    } catch (refreshError) {
      clearTokens();
      onLogout?.();
      onUnauthenticated?.();
      return Promise.reject(refreshError);
    }
  };

  publicApi.interceptors.request.use((config) => {
    if (!isAccessExpired()) return attachAuth(config);
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      return attachAuth(config);
    }
    return attachAuth(config);
  });

  publicApi.interceptors.response.use((response) => response, handleError);

  return publicApi;
};

export default setupPublicAuthInterceptor;
