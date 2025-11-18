const SESSION_FLOOR_KEY = 'haramCurrentFloor';
const FLOOR_EVENT_NAME = 'haram-floor-change';
const DEFAULT_FLOOR = 0;

let fallbackFloor = DEFAULT_FLOOR;

const normalizeFloor = (floor, fallback = fallbackFloor) => {
  if (typeof floor === 'number' && Number.isFinite(floor)) {
    return floor;
  }

  if (typeof floor === 'string' && floor.trim() !== '') {
    const parsed = Number(floor);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const emitFloorChange = (floor) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new CustomEvent(FLOOR_EVENT_NAME, { detail: { floor } }));
};

export const initializeSessionFloor = (defaultFloor) => {
  fallbackFloor = normalizeFloor(defaultFloor, DEFAULT_FLOOR);

  if (typeof window === 'undefined' || !window.sessionStorage) {
    return fallbackFloor;
  }

  const stored = window.sessionStorage.getItem(SESSION_FLOOR_KEY);
  if (stored === null || stored === undefined || stored === '') {
    window.sessionStorage.setItem(SESSION_FLOOR_KEY, String(fallbackFloor));
    return fallbackFloor;
  }

  const normalized = normalizeFloor(stored, fallbackFloor);
  if (normalized !== fallbackFloor) {
    fallbackFloor = normalized;
  }
  return normalized;
};

export const getSessionFloor = () => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return fallbackFloor;
  }

  const stored = window.sessionStorage.getItem(SESSION_FLOOR_KEY);
  return normalizeFloor(stored, fallbackFloor);
};

export const setSessionFloor = (floor) => {
  const normalized = normalizeFloor(floor, fallbackFloor);

  if (typeof window === 'undefined' || !window.sessionStorage) {
    fallbackFloor = normalized;
    return normalized;
  }

  const previous = window.sessionStorage.getItem(SESSION_FLOOR_KEY);
  if (previous !== String(normalized)) {
    window.sessionStorage.setItem(SESSION_FLOOR_KEY, String(normalized));
    emitFloorChange(normalized);
  }

  fallbackFloor = normalized;
  return normalized;
};

export const subscribeToSessionFloor = (handler) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const customHandler = (event) => {
    if (event?.detail && typeof handler === 'function') {
      handler(event.detail.floor);
    }
  };

  const storageHandler = (event) => {
    if (
      event.storageArea === window.sessionStorage &&
      event.key === SESSION_FLOOR_KEY &&
      typeof handler === 'function'
    ) {
      handler(normalizeFloor(event.newValue, fallbackFloor));
    }
  };

  window.addEventListener(FLOOR_EVENT_NAME, customHandler);
  window.addEventListener('storage', storageHandler);

  return () => {
    window.removeEventListener(FLOOR_EVENT_NAME, customHandler);
    window.removeEventListener('storage', storageHandler);
  };
};

export const getSessionFloorKey = () => SESSION_FLOOR_KEY;

export default getSessionFloor;
