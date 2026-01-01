import http from '../api/http';

const REQUEST_TIMEOUT_MS = 15000;
const ADMIN_COMMENTS_BASE_URL = '/api/v1/admin/comments';

export const listAdminComments = async ({
  page,
  perPage,
  status,
  postId,
  entityId,
  authorName,
  authorEmail,
  dateFrom,
  dateTo,
  sortBy,
  sortOrder
} = {}) => {
  const params = {};

  if (page) params.page = page;
  if (perPage) params.perPage = perPage;
  if (status) params.status = status;
  if (postId) params.postId = postId;
  if (entityId) params.entityId = entityId;
  if (authorName) params.authorName = authorName;
  if (authorEmail) params.authorEmail = authorEmail;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;

  const response = await http.get(ADMIN_COMMENTS_BASE_URL, {
    timeout: REQUEST_TIMEOUT_MS,
    params
  });

  return response.data;
};

export const getAdminComment = async (id) => {
  const response = await http.get(`${ADMIN_COMMENTS_BASE_URL}/${id}`, {
    timeout: REQUEST_TIMEOUT_MS
  });

  return response.data;
};

export const updateAdminCommentStatus = async (id, { status }) => {
  const response = await http.patch(
    `${ADMIN_COMMENTS_BASE_URL}/${id}/status`,
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

export const deleteAdminComment = async (id) => {
  const response = await http.delete(`${ADMIN_COMMENTS_BASE_URL}/${id}`, {
    timeout: REQUEST_TIMEOUT_MS
  });

  return response.data;
};

const adminCommentsService = {
  list: listAdminComments,
  get: getAdminComment,
  updateStatus: updateAdminCommentStatus,
  remove: deleteAdminComment
};

export default adminCommentsService;
