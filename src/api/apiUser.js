import axios from 'axios';
import appConfig from '../config/appConfig';
import { useUserAuthStore } from '../auth/user/userAuthStore';

const apiUser = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: {
    Accept: 'application/json'
  }
});

apiUser.interceptors.request.use((config) => {
  const { accessToken } = useUserAuthStore.getState();
  if (accessToken && !config?.headers?.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let userRefreshPromise = null;

apiUser.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};

    if (status !== 401 || originalRequest._userRetry) {
      return Promise.reject(error);
    }

    const store = useUserAuthStore.getState();
    if (!store.refreshToken) {
      store.clearSession();
      return Promise.reject(error);
    }

    if (!userRefreshPromise) {
      userRefreshPromise = store
        .refreshSession()
        .catch((refreshError) => {
          store.clearSession();
          throw refreshError;
        })
        .finally(() => {
          userRefreshPromise = null;
        });
    }

    try {
      const { accessToken } = await userRefreshPromise;
      originalRequest._userRetry = true;
      originalRequest.headers = originalRequest.headers || {};
      if (accessToken) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      }
      return apiUser(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default apiUser;
