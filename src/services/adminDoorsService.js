import apiAdmin from '../api/apiAdmin';

const DOORS_BASE_URL = '/api/v1/doors';

export const createDoor = async ({
  x,
  y,
  floor,
  allowed_gender = 'both',
  is_open = true,
  modes = ['walk',
    'wheelchair'],
  bidirectional = true,
  signal
}) => {
  const response = await apiAdmin.post(DOORS_BASE_URL, {
    x,
    y,
    floor,
    allowed_gender,
    is_open,
    modes,
    bidirectional
  }, { signal });

  return response.data;
};

export const getDoorInfo = async (id, { signal } = {}) => {
  const response = await apiAdmin.get(`${DOORS_BASE_URL}/${id}/info`, { signal });
  return response.data;
};

export const updateDoorInfo = async (id, payload, { signal } = {}) => {
  const response = await apiAdmin.put(`${DOORS_BASE_URL}/${id}/info`, payload || {}, { signal });
  return response.data;
};

export const moveDoor = async (id, { x, y, floor }, { signal } = {}) => {
  const response = await apiAdmin.put(`${DOORS_BASE_URL}/${id}/move`, { x, y, floor }, { signal });
  return response.data;
};

export const deleteDoor = async (id, { signal } = {}) => {
  const response = await apiAdmin.delete(`${DOORS_BASE_URL}/${id}`, { signal });
  return response.data;
};

export const bulkOpenCloseDoors = async ({ door_ids = [], is_open }, { signal } = {}) => {
  const response = await apiAdmin.patch(`${DOORS_BASE_URL}/bulk-open`, {
    door_ids,
    is_open
  }, { signal });

  return response.data;
};

export default createDoor;
