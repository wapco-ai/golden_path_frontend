import apiAdmin from '../api/apiAdmin';

const AREAS_BASE_URL = '/api/v1/areas';

const buildAreaUrl = (id) => `${AREAS_BASE_URL}/${encodeURIComponent(id)}`;

const normalizeAreaRecord = (record) => {
  if (!record) return record;

  if (typeof record?.geom_geojson === 'string') {
    try {
      const parsedGeom = JSON.parse(record.geom_geojson);

      return {
        ...record,
        geom: parsedGeom
      };
    } catch (error) {
      return record;
    }
  }

  return record;
};

const normalizeAreasResponse = (payload) => {
  if (payload?.data && Array.isArray(payload.data)) {
    return {
      ...payload,
      data: payload.data.map(normalizeAreaRecord)
    };
  }

  return normalizeAreaRecord(payload);
};

export const listAreas = async (params = {}, { signal } = {}) => {
  const response = await apiAdmin.get(AREAS_BASE_URL, {
    params,
    signal
  });

  return normalizeAreasResponse(response.data);
};

export const createArea = async (payload, { signal } = {}) => {
  const response = await apiAdmin.post(AREAS_BASE_URL, payload || {}, { signal });
  return response.data;
};

export const getAreaInfo = async (id, params = {}, { signal } = {}) => {
  const response = await apiAdmin.get(buildAreaUrl(id), {
    params,
    signal
  });

  return normalizeAreasResponse(response.data);
};

export const updateAreaInfo = async (id, payload, { signal } = {}) => {
  const response = await apiAdmin.put(buildAreaUrl(id), payload || {}, { signal });
  return response.data;
};

export const moveArea = async (id, payload, { signal } = {}) => {
  const response = await apiAdmin.put(`${AREAS_BASE_URL}/${id}/move`, payload || {}, { signal });
  return response.data;
};

export const deleteArea = async (id, { signal } = {}) => {
  const response = await apiAdmin.delete(buildAreaUrl(id), { signal });
  return response.data;
};

export default createArea;
