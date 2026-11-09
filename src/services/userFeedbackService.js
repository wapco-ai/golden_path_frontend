import appConfig from '../config/appConfig.js';
import { userRequest } from '../api/userRequest.js';

export const submitUserFeedback = async ({
  targetType = 'poi',
  targetId,
  poiId,
  title,
  body,
  comment,
  rating = 0,
  language,
  lang
} = {}) => {
  const resolvedTargetId = targetId ?? poiId;

  if (!resolvedTargetId) {
    throw new Error('targetId (or poiId) is required to submit feedback');
  }

  const resolvedLanguage = language || lang;
  const resolvedBody = body ?? comment ?? '';
  const resolvedTitle = title || resolvedBody?.slice?.(0, 80) || '';

  const payload = {
    targetType,
    targetId: resolvedTargetId,
    lang: resolvedLanguage,
    rating: rating > 0 ? rating : null,
    title: resolvedTitle,
    body: resolvedBody
  };

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  const response = await userRequest(appConfig.userFeedbackUrl, {
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
