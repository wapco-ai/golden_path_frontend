import apiAdmin from '../api/apiAdmin';

const ADMIN_SUPPORT_FEEDBACKS_URL = '/api/v1/admin/support-feedbacks';
const REQUEST_TIMEOUT = 15000;

export const listAdminSupportFeedbacks = async ({ status, q, limit = 20, page = 1 } = {}, { signal } = {}) => {
  const response = await apiAdmin.get(ADMIN_SUPPORT_FEEDBACKS_URL, {
    signal,
    timeout: REQUEST_TIMEOUT,
    params: {
      status,
      q,
      limit,
      page
    }
  });
  return response.data;
};

export const updateAdminSupportFeedbackStatus = async (id, payload, { signal } = {}) => {
  const response = await apiAdmin.patch(
    `${ADMIN_SUPPORT_FEEDBACKS_URL}/${encodeURIComponent(id)}`,
    payload || {},
    {
      signal,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
};
