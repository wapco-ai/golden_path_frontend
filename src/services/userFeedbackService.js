import appConfig from '../config/appConfig.js';
import { USER_ACCESS_TOKEN_KEY, useUserAuthStore } from '../auth/user/userAuthStore';

const createGuestFeedbackToken = () => {
  if (typeof window === 'undefined') return null;

  const storageKey = 'guestFeedbackToken';
  const storedToken = window.sessionStorage?.getItem?.(storageKey) || window.localStorage?.getItem?.(storageKey);
  if (storedToken) return storedToken;

  const generateRandomId = () => {
    if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
      return crypto.randomUUID();
    }

    return Math.random().toString(36).slice(2, 10);
  };

  const guestToken = `guest-feedback-${generateRandomId()}`;

  window.sessionStorage?.setItem?.(storageKey, guestToken);

  return guestToken;
};

const resolveAuthToken = (providedToken) => {
  if (providedToken) return providedToken;

  if (appConfig.userFeedbackAuthToken) {
    return appConfig.userFeedbackAuthToken;
  }

  const storeToken = useUserAuthStore.getState().accessToken;
  if (storeToken) return storeToken;

  if (typeof window !== 'undefined') {
    const sessionToken = window.sessionStorage?.getItem?.(USER_ACCESS_TOKEN_KEY);
    if (sessionToken) return sessionToken;

    const localToken = window.localStorage?.getItem?.(USER_ACCESS_TOKEN_KEY);
    if (localToken) return localToken;
  }

  return createGuestFeedbackToken();
};

export const submitUserFeedback = async ({
  targetType = 'poi',
  targetId,
  poiId,
  title,
  body,
  comment,
  rating = 0,
  language,
  lang,
  authToken
} = {}) => {
  const resolvedTargetId = targetId ?? poiId;

  if (!resolvedTargetId) {
    throw new Error('targetId (or poiId) is required to submit feedback');
  }

  const token = resolveAuthToken(authToken);
  const resolvedLanguage = language || lang;
  const resolvedBody = body ?? comment ?? '';
  const resolvedTitle = title || resolvedBody?.slice?.(0, 80) || '';

  const payload = {
    targetType,
    targetId: resolvedTargetId,
    lang: resolvedLanguage,
    rating,
    title: resolvedTitle,
    body: resolvedBody
  };

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(appConfig.userFeedbackUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || `user feedback request failed with status ${response.status}`);
  }

  return data;
};

export default submitUserFeedback;
