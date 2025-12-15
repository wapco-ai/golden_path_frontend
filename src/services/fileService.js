import apiAdmin from '../api/apiAdmin';

const FILES_BASE_URL = '/api/v1/files';

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

  const response = await apiAdmin.post(FILES_BASE_URL, formData, {
    headers: {
      Accept: 'application/json'
    }
  });

  return response.data;
};

export const deleteFile = async (path) => {
  if (!path) return null;

  const url = `${FILES_BASE_URL}?path=${encodeURIComponent(path)}`;
  const response = await apiAdmin.delete(url, {
    headers: {
      Accept: 'application/json'
    }
  });

  return response.data;
};

export const getFileUrl = (path, { inline = false, as } = {}) => {
  if (!path) return '';
  const params = new URLSearchParams({ path });
  if (inline) params.set('inline', '1');
  if (as) params.set('as', as);
  return `${apiAdmin.defaults.baseURL}${FILES_BASE_URL}?${params.toString()}`;
};
