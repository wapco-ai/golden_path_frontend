const ACCESS_TOKEN_KEY = 'gp_public_access_token';
const REFRESH_TOKEN_KEY = 'gp_public_refresh_token';
const EXPIRES_AT_KEY = 'gp_public_expires_at';

const safeStorage = () => {
  if (typeof window === 'undefined' || !window?.localStorage) {
    const memory = new Map();
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
      clear: () => memory.clear(),
      key: (index) => Array.from(memory.keys())[index] ?? null,
      get length() {
        return memory.size;
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

export const setTokens = ({ accessToken, refreshToken, expiresIn }) => {
  const expiresAt = Date.now() + expiresIn * 1000;
  storage.setItem(ACCESS_TOKEN_KEY, accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  storage.setItem(EXPIRES_AT_KEY, String(expiresAt));
};

export const clearTokens = () => {
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
  storage.removeItem(EXPIRES_AT_KEY);
};

export const isAccessExpired = () => {
  const expiresAt = getExpiresAt();
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - 30_000; // 30s skew
};

export default {
  getAccessToken,
  getRefreshToken,
  getExpiresAt,
  setTokens,
  clearTokens,
  isAccessExpired
};
