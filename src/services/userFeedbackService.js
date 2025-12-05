import appConfig from '../config/appConfig.js';

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

  return null;
};

export const submitUserFeedback = async ({ poiId, comment, rating = 0, language, authToken } = {}) => {
  if (!poiId) {
    throw new Error('poiId is required to submit feedback');
  }

  const token = resolveAuthToken(authToken);

  if (!token) {
    throw new Error('Authentication token is required to submit feedback');
  }

  const payload = {
    poi_id: poiId,
    comment,
    rating,
    language,
    lang: language
  };

  const response = await fetch(appConfig.userFeedbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || `user feedback request failed with status ${response.status}`);
  }

  return data;
};

export default submitUserFeedback;
