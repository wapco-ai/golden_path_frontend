import http from '../api/http';
import appConfig from '../config/appConfig';

const REQUEST_TIMEOUT_MS = 15000;
const ADMIN_SUPPORT_FEEDBACKS_URL = appConfig.adminSupportFeedbacksUrl;

export const listAdminSupportFeedbacks = async ({ status, q, limit = 20, page = 1 } = {}) => {
  const params = {};

  if (status) params.status = status;
  if (q) params.q = q;
  if (limit) params.limit = limit;
  if (page) params.page = page;

  const response = await http.get(ADMIN_SUPPORT_FEEDBACKS_URL, {
    timeout: REQUEST_TIMEOUT_MS,
    params
  });

  return response.data;
};

export const updateAdminSupportStatus = async (id, { status }) => {
  const response = await http.patch(
    `${ADMIN_SUPPORT_FEEDBACKS_URL}/${id}`,
    { status },
    {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
};

const adminSupportApi = {
  list: listAdminSupportFeedbacks,
  updateStatus: updateAdminSupportStatus
};

export default adminSupportApi;
