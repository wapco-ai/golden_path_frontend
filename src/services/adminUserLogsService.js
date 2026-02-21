import http from '../api/http';

const USER_LOGS_BASE_URL = '/api/v1/admin/user-logs';

export const fetchAdminUserLogs = async ({
  page = 1,
  pageSize = 6,
  search,
  sortBy = 'lastLogin',
  sortOrder = 'desc',
  fromDate,
  toDate
} = {}) => {
  const params = {
    page,
    pageSize,
    sortBy,
    sortOrder
  };

  if (search) params.search = search;
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const response = await http.get(USER_LOGS_BASE_URL, { params });
  return response.data;
};

export const exportAdminUserLogs = async ({
  page,
  pageSize,
  search,
  sortBy = 'lastLogin',
  sortOrder = 'desc',
  fromDate,
  toDate
} = {}) => {
  const params = {
    sortBy,
    sortOrder
  };

  if (page) params.page = page;
  if (pageSize) params.pageSize = pageSize;
  if (search) params.search = search;
  if (fromDate) params.fromDate = fromDate;
  if (toDate) params.toDate = toDate;

  const response = await http.get(`${USER_LOGS_BASE_URL}/export`, {
    params,
    responseType: 'blob'
  });

  return response.data;
};

const adminUserLogsService = {
  fetchAdminUserLogs,
  exportAdminUserLogs
};

export default adminUserLogsService;
