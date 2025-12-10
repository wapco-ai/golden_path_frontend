import appConfig from '../config/appConfig.js';
import { ADMIN_ACCESS_TOKEN_KEY } from './adminAuthService.js';

const AREAS_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/areas`;

const buildAreaUrl = (id) => `${AREAS_BASE_URL}/${encodeURIComponent(id)}`;

const buildAuthHeaders = () => {
  const accessToken = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
};

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
      // اگر رشته‌ی GeoJSON معتبر نباشد، همان ساختار اصلی را برمی‌گردانیم
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
  const url = new URL(AREAS_BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    if (typeof value === 'boolean') {
      url.searchParams.append(key, value ? '1' : '0');
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== '') {
          url.searchParams.append(key, item);
        }
      });
    } else {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: buildAuthHeaders(),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'دریافت لیست محدوده‌ها ناموفق بود');
  }

  return normalizeAreasResponse(data);
};

export const createArea = async (payload, { signal } = {}) => {
  const response = await fetch(AREAS_BASE_URL, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'ثبت محدوده جدید ناموفق بود');
  }

  return data;
};

export const getAreaInfo = async (id, params = {}, { signal } = {}) => {
  const url = new URL(buildAreaUrl(id));

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    method: 'GET',
    headers: buildAuthHeaders(),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'دریافت اطلاعات محدوده ناموفق بود');
  }

  return normalizeAreasResponse(data);
};

export const updateAreaInfo = async (id, payload, { signal } = {}) => {
  const response = await fetch(buildAreaUrl(id), {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'ثبت اطلاعات محدوده ناموفق بود');
  }

  return data;
};

export const moveArea = async (id, payload, { signal } = {}) => {
  const response = await fetch(`${AREAS_BASE_URL}/${id}/move`, {
    method: 'PUT',
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload || {}),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'جابجایی محدوده ناموفق بود');
  }

  return data;
};

export const deleteArea = async (id, { signal } = {}) => {
  const response = await fetch(buildAreaUrl(id), {
    method: 'DELETE',
    headers: buildAuthHeaders(),
    signal
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || 'حذف محدوده ناموفق بود');
  }

  return data;
};

export default createArea;
