import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import publicApi from './publicApi';
import { clearTokens, getAccessToken, getRefreshToken, isAccessExpired, setTokens } from './publicTokenStore';
import { refresh as refreshSession } from './publicAuthClient';

let refreshPromise: Promise<any> | null = null;

const isPublicRequest = (config: AxiosRequestConfig) => {
  const url = config.url || '';
  return url.startsWith('/auth') || url.startsWith('/users');
};

export const setupPublicAuthInterceptor = ({ onLogout, onUnauthenticated }: { onLogout?: () => void; onUnauthenticated?: () => void }) => {
  const attachAuth = (config: AxiosRequestConfig) => {
    if ((config as any).skipAuth) return config;
    const token = getAccessToken();
    if (token && (!config.headers || !('Authorization' in config.headers))) {
      config.headers = config.headers || {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
    return config;
  };

  const handleError = async (error: AxiosError) => {
    const status = error?.response?.status;
    const originalRequest: any = error.config || {};

    if (!status || status !== 401 || originalRequest._publicRetry || (originalRequest as any).skipAuth || !isPublicRequest(originalRequest)) {
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
