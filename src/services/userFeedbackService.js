import appConfig from '../config/appConfig.js';

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

  if (typeof window !== 'undefined') {
    const sessionToken = window.sessionStorage?.getItem?.('authToken');
    if (sessionToken) return sessionToken;

    const localToken = window.localStorage?.getItem?.('authToken');
    if (localToken) return localToken;
  }

  return createGuestFeedbackToken();
};

export const submitUserFeedback = async ({ poiId, comment, rating = 0, language, authToken } = {}) => {
  if (!poiId) {
    throw new Error('poiId is required to submit feedback');
  }

  const token = resolveAuthToken(authToken);

  const payload = {
    poi_id: poiId,
    comment,
    rating,
    language,
    lang: language
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
