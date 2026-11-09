import apiUser from './apiUser.js';

// Compatibility for fetch-based services, with the same login refresh/session
// protection as the rest of the user API. No tokens are read from stale storage.
export async function userRequest(url, options = {}) {
  try {
    const response = await apiUser({
      url, method: options.method || 'GET', headers: options.headers,
      data: options.body, signal: options.signal, timeout: options.timeout ?? 15000
    });
    return { ok: true, status: response.status, json: async () => response.data };
  } catch (error) {
    if (error.code === 'ERR_CANCELED') throw new DOMException('Request aborted', 'AbortError');
    if (error.response) {
      return { ok: false, status: error.response.status,
        json: async () => error.response.data, text: async () => JSON.stringify(error.response.data) };
    }
    throw error;
  }
}
