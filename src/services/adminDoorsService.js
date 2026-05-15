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

export const getDoorGraphStatus = async (id, { signal } = {}) => {
  const response = await apiAdmin.get(`${DOORS_BASE_URL}/${id}/graph-status`, { signal });
  return response.data;
};

const createAbortError = () => {
  const error = new Error('Polling aborted');
  error.name = 'AbortError';
  return error;
};

const waitForDoorGraphPollInterval = (intervalMs, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(createAbortError());
    return;
  }

  const handleAbort = () => {
    clearTimeout(timeoutId);
    reject(createAbortError());
  };

  const timeoutId = setTimeout(() => {
    signal?.removeEventListener('abort', handleAbort);
    resolve();
  }, intervalMs);

  signal?.addEventListener('abort', handleAbort, { once: true });
});

export async function pollDoorGraphStatus(doorId, {
  intervalMs = 3000,
  timeoutMs = 300000,
  signal,
  onStatus,
  onDone,
  onFailed
} = {}) {
  const startedAt = Date.now();

  while (!signal?.aborted) {
    if (Date.now() - startedAt > timeoutMs) {
      onFailed?.({
        status: 'timeout',
        message: 'بروزرسانی گراف بیش از حد طول کشید.'
      });
      return;
    }

    const result = await getDoorGraphStatus(doorId, { signal });
    const graph = result?.graph || {};
    const status = graph.status || 'unknown';

    onStatus?.({ ...graph, status });

    if (status === 'ready') {
      onDone?.({ ...graph, status });
      return;
    }

    if (status === 'failed') {
      onFailed?.({ ...graph, status });
      return;
    }

    await waitForDoorGraphPollInterval(intervalMs, signal);
  }
}

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
