import axios from 'axios';
import appConfig from '../config/appConfig';
import { isSameUserSession, useUserAuthStore } from '../auth/user/userAuthStore';

const apiUser = axios.create({
  baseURL: appConfig.apiBaseUrl,
  headers: {
    Accept: 'application/json'
  }
});

apiUser.interceptors.request.use((config) => {
  // A new OTP login must not inherit or refresh another saved user's session.
  if (config.skipUserAuth) return config;
  const currentSession = useUserAuthStore.getState();
  if (config._userSession && !isSameUserSession(config._userSession, currentSession)) {
    return Promise.reject(new Error('User session changed before request'));
  }
  const { accessToken, refreshToken, sessionGeneration } = currentSession;
  if (accessToken && (config._userRetry || !config?.headers?.Authorization)) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  config._userSession = { accessToken, refreshToken, sessionGeneration };
  return config;
});

let userRefreshTask = null;

const retryForCurrentSession = (request, currentSession) => {
  request._userRetry = true;
  request._userSession = {
    accessToken: currentSession.accessToken,
    refreshToken: currentSession.refreshToken,
    sessionGeneration: currentSession.sessionGeneration
  };
  request.headers = request.headers || {};
  request.headers.Authorization = `Bearer ${currentSession.accessToken}`;
  return apiUser(request);
};

apiUser.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config || {};

    if (status !== 401 || originalRequest._userRetry || originalRequest.skipUserAuth) {
      return Promise.reject(error);
    }

    const store = useUserAuthStore.getState();
    const requestSession = originalRequest._userSession;
    if (!isSameUserSession(requestSession, store)
      || originalRequest.headers?.Authorization !== `Bearer ${requestSession.accessToken}`) {
      return Promise.reject(error);
    }
    // Another request may already have refreshed this login while this 401 was in flight.
    if (store.accessToken && requestSession.accessToken !== store.accessToken) {
      return retryForCurrentSession(originalRequest, store);
    }
    if (!store.refreshToken) {
      store.clearSession();
      return Promise.reject(error);
    }

    let refreshTask = userRefreshTask;
    if (!refreshTask || !isSameUserSession(refreshTask.session, store)) {
      refreshTask = { session: requestSession };
      refreshTask.promise = store
        .refreshSession()
        .catch((refreshError) => {
          const currentSession = useUserAuthStore.getState();
          if (isSameUserSession(requestSession, currentSession)
            && requestSession.refreshToken === currentSession.refreshToken) currentSession.clearSession();
          throw refreshError;
        })
        .finally(() => {
          if (userRefreshTask === refreshTask) userRefreshTask = null;
        });
      userRefreshTask = refreshTask;
    }

    try {
      await refreshTask.promise;
      const currentSession = useUserAuthStore.getState();
      if (!isSameUserSession(requestSession, currentSession) || !currentSession.accessToken) {
        return Promise.reject(new Error('User session changed during refresh'));
      }
      return retryForCurrentSession(originalRequest, currentSession);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default apiUser;
