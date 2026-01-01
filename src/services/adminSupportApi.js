import http from '../api/http';

const REQUEST_TIMEOUT_MS = 15000;

export const listAdminSupportFeedbacks = async ({ status, q, limit = 20, page = 1 } = {}) => {
  const params = {};

  if (status) params.status = status;
  if (q) params.q = q;
  if (limit) params.limit = limit;
  if (page) params.page = page;

  const response = await http.get('/admin/support-feedbacks', {
    timeout: REQUEST_TIMEOUT_MS,
    params
  });

  return response.data;
};

export const updateAdminSupportStatus = async (id, { status }) => {
  const response = await http.patch(
    `/admin/support-feedbacks/${id}`,
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
