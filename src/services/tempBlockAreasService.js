import apiAdmin from '../api/apiAdmin';

const TEMP_BLOCK_AREA_BASE_URL = '/api/v1/admin/temp-block-areas';

export const createTempBlockArea = async (payload, { signal } = {}) => {
  const response = await apiAdmin.post(TEMP_BLOCK_AREA_BASE_URL, payload || {}, { signal });
  return response.data;
};

export const updateTempBlockArea = async (id, payload, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await apiAdmin.put(`${TEMP_BLOCK_AREA_BASE_URL}/${id}`, payload || {}, { signal });
  return response.data;
};

export const getTempBlockArea = async (id, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await apiAdmin.get(`${TEMP_BLOCK_AREA_BASE_URL}/${id}`, { signal });
  return response.data;
};

export const deleteTempBlockArea = async (id, { signal } = {}) => {
  const response = await apiAdmin.delete(`${TEMP_BLOCK_AREA_BASE_URL}/${id}`, { signal });
  return response.data;
};

export const stopTempBlockArea = async (id, payload = {}, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await apiAdmin.patch(`${TEMP_BLOCK_AREA_BASE_URL}/${id}/stop`, payload || {}, { signal });
  return response.data;
};

export const extendTempBlockArea = async (id, payload = {}, { signal } = {}) => {
  if (!id) {
    throw new Error('شناسه محدوده موقت نامعتبر است');
  }

  const response = await apiAdmin.patch(`${TEMP_BLOCK_AREA_BASE_URL}/${id}/extend`, payload || {}, { signal });
  return response.data;
};

export default createTempBlockArea;
