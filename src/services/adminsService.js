import http from '../api/http';
import { useAdminAuthStore } from '../auth/admin/adminAuthStore';

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

export const updateAdmin = async (id, payload) => {
  const response = await http.patch(`${ADMIN_ADMINS_BASE_URL}/${id}`, payload);
  const store = useAdminAuthStore.getState();
  if (store.admin?.id != null && String(store.admin.id) === String(id)) {
    // Apply an edited account's permissions immediately in its current session.
    // If the fresh profile cannot be verified, discard the old permissions.
    await store.fetchProfile().catch(() => store.clearAuth());
  }
  return response.data;
};

export const updateAdminRoles = async (id, roles) => {
  return updateAdmin(id, { roles });
};

export const deleteAdmin = async (id) => {
  const response = await http.delete(`${ADMIN_ADMINS_BASE_URL}/${id}`);
  return response.data;
};
