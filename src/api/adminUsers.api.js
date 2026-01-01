import http from './http';

export const fetchSignedUsers = async ({ page = 1, pageSize = 20, search = '' }) => {
  const params = {
    page,
    pageSize
  };

  if (search) {
    params.search = search;
  }

  const response = await http.get('/admin/users', { params });
  return response.data;
};

export const fetchSignedUser = async (id) => {
  const response = await http.get(`/admin/users/${id}`);
  return response.data;
};

export const updateSignedUserStatus = async (id, status) => {
  const response = await http.patch(`/admin/users/${id}/status`, { status });
  return response.data;
};
