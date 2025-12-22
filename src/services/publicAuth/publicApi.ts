import axios from 'axios';
import appConfig from '../../config/appConfig';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStore';
import { AuthTokensDTO } from './types';
import { enqueueRefresh } from './refreshQueue';

const publicApi = axios.create({
  baseURL: `${appConfig.apiBaseUrl}/api/v1`,
  headers: {
    Accept: 'application/json'
  }
});

const refreshClient = axios.create({
  baseURL: `${appConfig.apiBaseUrl}/api/v1`,
  headers: {
    Accept: 'application/json'
  }
});

const refreshTokens = async (refreshToken: string): Promise<AuthTokensDTO> => {
  const { data } = await refreshClient.post<AuthTokensDTO>('/auth/refresh', { refreshToken }, { headers: { Authorization: undefined } });
  if (data?.accessToken && data?.refreshToken && data?.expiresIn) {
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn });
  }
  return data;
};

publicApi.interceptors.request.use((config) => {
  if ((config as any).skipAuth) {
    return config;
  }

  const token = getAccessToken();
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

publicApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};

    if (status !== 401 || originalRequest._publicRetry || (originalRequest as any).skipAuth) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      return Promise.reject(error);
    }

    try {
      const { accessToken } = await enqueueRefresh(() => refreshTokens(refreshToken));
      if (!accessToken) {
        clearTokens();
        return Promise.reject(error);
      }
      originalRequest._publicRetry = true;
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return publicApi(originalRequest);
    } catch (refreshError) {
      clearTokens();
      return Promise.reject(refreshError);
    }
  }
);

export default publicApi;
export { refreshTokens };
