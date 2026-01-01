import http from './http';

const ADMIN_USERS_BASE_PATH = '/api/v1/admin/users';

export const fetchSignedUsers = async ({ page = 1, pageSize = 20, search = '' }) => {
  const params = {
    page,
    pageSize
  };

  if (search) {
    params.search = search;
  }

  const response = await http.get(ADMIN_USERS_BASE_PATH, { params });
  return response.data;
};

export const fetchSignedUser = async (id) => {
  const response = await http.get(`${ADMIN_USERS_BASE_PATH}/${id}`);
  return response.data;
};

export const updateSignedUserStatus = async (id, status) => {
  const response = await http.patch(`${ADMIN_USERS_BASE_PATH}/${id}/status`, { status });
  return response.data;
};
