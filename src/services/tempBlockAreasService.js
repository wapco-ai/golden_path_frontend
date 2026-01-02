import apiAdmin from '../api/apiAdmin';
import appConfig from '../config/appConfig';

export const createTempBlockArea = async (payload, { signal } = {}) => {
  const response = await apiAdmin.post(appConfig.adminTempBlockAreasBaseUrl, payload || {}, { signal });
  return response.data;
};

export const updateTempBlockArea = async (id, payload, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await apiAdmin.put(`${appConfig.adminTempBlockAreasBaseUrl}/${id}`, payload || {}, { signal });
  return response.data;
};

export const getTempBlockArea = async (id, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await apiAdmin.get(`${appConfig.adminTempBlockAreasBaseUrl}/${id}`, { signal });
  return response.data;
};

export const deleteTempBlockArea = async (id, { signal } = {}) => {
  const response = await apiAdmin.delete(`${appConfig.adminTempBlockAreasBaseUrl}/${id}`, { signal });
  return response.data;
};

export const stopTempBlockArea = async (id, payload = {}, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await apiAdmin.patch(`${appConfig.adminTempBlockAreasBaseUrl}/${id}/stop`, payload || {}, { signal });
  return response.data;
};

export const extendTempBlockArea = async (id, payload = {}, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await apiAdmin.patch(`${appConfig.adminTempBlockAreasBaseUrl}/${id}/extend`, payload || {}, { signal });
  return response.data;
};

export default createTempBlockArea;
