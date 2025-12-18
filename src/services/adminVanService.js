import apiAdmin from '../api/apiAdmin';

const VAN_ADMIN_BASE_URL = '/api/v1/admin/van';

export const createVanNode = async (payload, { signal } = {}) => {
  const response = await apiAdmin.post(`${VAN_ADMIN_BASE_URL}/nodes`, payload || {}, { signal });
  return response.data;
};

export const createVanEdge = async (payload, { signal } = {}) => {
  const response = await apiAdmin.post(`${VAN_ADMIN_BASE_URL}/edges`, payload || {}, { signal });
  return response.data;
};

export const deleteVanNode = async (id, { signal } = {}) => {
  const response = await apiAdmin.delete(`${VAN_ADMIN_BASE_URL}/nodes/${encodeURIComponent(id)}`, { signal });
  return response.data;
};

export const deleteVanNode = async (nodeId, { signal } = {}) => {
  const response = await fetch(`${VAN_ADMIN_BASE_URL}/nodes/${nodeId}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
    signal
  });

  return handleResponse(response, 'حذف گره ون ناموفق بود');
};

export default createVanNode;
