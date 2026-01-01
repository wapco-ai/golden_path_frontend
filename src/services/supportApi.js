import apiUser from '../api/apiUser';

const REQUEST_TIMEOUT_MS = 15000;

export const sendSupportFeedback = async ({ subject, message }) => {
  const response = await apiUser.post(
    '/support/feedback',
    { subject, message },
    {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
};

export const getMyFeedbacks = async ({ limit = 20, page = 1 } = {}) => {
  const response = await apiUser.get('/support/feedbacks/me', {
    timeout: REQUEST_TIMEOUT_MS,
    params: {
      limit,
      page
    }
  });

  return response.data;
};

const supportApi = {
  sendFeedback: sendSupportFeedback,
  getMyFeedbacks
};

export default supportApi;
