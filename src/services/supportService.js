import apiUser from '../api/apiUser';

const SUPPORT_FEEDBACK_BASE_URL = '/api/v1/support/feedback';
const SUPPORT_FEEDBACKS_ME_URL = '/api/v1/support/feedbacks/me';
const REQUEST_TIMEOUT = 15000;

export const sendSupportFeedback = async (payload, { signal } = {}) => {
  const response = await apiUser.post(SUPPORT_FEEDBACK_BASE_URL, payload, {
    signal,
    timeout: REQUEST_TIMEOUT,
    headers: {
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

export const getMyFeedbacks = async ({ limit = 20, page = 1 } = {}, { signal } = {}) => {
  const response = await apiUser.get(SUPPORT_FEEDBACKS_ME_URL, {
    signal,
    timeout: REQUEST_TIMEOUT,
    params: {
      limit,
      page
    }
  });
  return response.data;
};
