import http from '../api/http';

const ADMIN_ADMINS_BASE_URL = '/api/v1/admin/admins';

export const getAdmins = async ({ page = 1, pageSize = 5, search = '' }) => {
  const params = {
    page,
    pageSize
  };

  if (search) {
    params.search = search;
  }

  const response = await http.get(ADMIN_ADMINS_BASE_URL, { params });
  return response.data;
};

export const getAdminById = async (id) => {
  const response = await http.get(`${ADMIN_ADMINS_BASE_URL}/${id}`);
  return response.data;
};

export const createAdmin = async (payload) => {
  const response = await http.post(ADMIN_ADMINS_BASE_URL, payload);
  return response.data;
};

export const updateAdminRoles = async (id, roles) => {
  const response = await http.patch(`${ADMIN_ADMINS_BASE_URL}/${id}`, { roles });
  return response.data;
};

export const deleteAdmin = async (id) => {
  const response = await http.delete(`${ADMIN_ADMINS_BASE_URL}/${id}`);
  return response.data;
};
