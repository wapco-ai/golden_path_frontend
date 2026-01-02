import apiAdmin from '../api/apiAdmin';
import appConfig from '../config/appConfig';

export const createVanNode = async (payload, { signal } = {}) => {
  const response = await apiAdmin.post(`${appConfig.adminVanBaseUrl}/nodes`, payload || {}, { signal });
  return response.data;
};

export const createVanEdge = async (payload, { signal } = {}) => {
  const response = await apiAdmin.post(`${appConfig.adminVanBaseUrl}/edges`, payload || {}, { signal });
  return response.data;
};

export const deleteVanNode = async (id, { signal } = {}) => {
  const response = await apiAdmin.delete(`${appConfig.adminVanBaseUrl}/nodes/${encodeURIComponent(id)}`, { signal });
  return response.data;
};

export default createVanNode;
