import appConfig from '../config/appConfig.js';

export const submitUserFeedback = async ({ poiId, comment, rating = 0, language } = {}) => {
  if (!poiId) {
    throw new Error('poiId is required to submit feedback');
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
      Accept: 'application/json'
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
