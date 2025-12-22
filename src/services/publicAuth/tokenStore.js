const ACCESS_TOKEN_KEY = 'gp_public_access_token';
const REFRESH_TOKEN_KEY = 'gp_public_refresh_token';
const EXPIRES_AT_KEY = 'gp_public_expires_at';

const safeStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    const store = new Map();
    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => {
        store.set(key, String(value));
      },
      removeItem: (key) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
      key: (index) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size;
      }
    };
  }
  return window.localStorage;
};

const storage = safeStorage();

export const getAccessToken = () => storage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => storage.getItem(REFRESH_TOKEN_KEY);
export const getExpiresAt = () => {
  const raw = storage.getItem(EXPIRES_AT_KEY);
  return raw ? Number(raw) : null;
};

export const isExpired = () => {
  const expiresAt = getExpiresAt();
  if (!expiresAt) return true;
  return Date.now() >= expiresAt;
};

export const setTokens = ({ accessToken, refreshToken, expiresIn }) => {
  if (accessToken) {
    storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  if (expiresIn) {
    const expiresAt = Date.now() + expiresIn * 1000;
    storage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  }
};

export const clearTokens = () => {
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(EXPIRES_AT_KEY);
};

export default {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  isExpired,
  getExpiresAt
};
