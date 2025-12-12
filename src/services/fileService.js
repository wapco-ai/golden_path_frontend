import appConfig from '../config/appConfig';
import { ADMIN_ACCESS_TOKEN_KEY } from './adminAuthService';

const FILES_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/files`;

const buildAuthHeaders = () => {
  const accessToken = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

  return accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {};
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'File service request failed');
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
};

export const uploadFile = async ({
  file,
  entityTable,
  entityId,
  bucket = 'files',
  keepOriginalName = false
}) => {
  if (!file) {
    throw new Error('فایل برای آپلود ارسال نشده است');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('entity_table', entityTable);
  formData.append('entity_id', entityId);
  if (bucket) formData.append('bucket', bucket);
  formData.append('keep_original_name', keepOriginalName ? 'true' : 'false');

  const response = await fetch(FILES_BASE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...buildAuthHeaders()
    },
    body: formData
  });

  return handleResponse(response);
};

export const deleteFile = async (path) => {
  if (!path) return null;

  const url = `${FILES_BASE_URL}?path=${encodeURIComponent(path)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      ...buildAuthHeaders()
    }
  });

  return handleResponse(response);
};

export const getFileUrl = (path, { inline = false, as } = {}) => {
  if (!path) return '';
  const params = new URLSearchParams({ path });
  if (inline) params.set('inline', '1');
  if (as) params.set('as', as);
  return `${FILES_BASE_URL}?${params.toString()}`;
};
