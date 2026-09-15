export const DEFAULT_MAP_PATH = '/mpb';
export const PROFILE_PATH = '/profile';
export const PROFILE_INFO_PATH = '/pinfo';
export const PROFILE_ORIGIN_KEY = 'profile_origin_page';

const INVALID_PROFILE_ORIGINS = new Set([
  '/',
  '/login',
  PROFILE_PATH,
  PROFILE_INFO_PATH
]);

export const getValidProfileOrigin = (storage) => {
  const origin = storage?.getItem?.(PROFILE_ORIGIN_KEY);

  if (
    !origin
    || typeof origin !== 'string'
    || !origin.startsWith('/')
    || origin.startsWith('//')
    || INVALID_PROFILE_ORIGINS.has(origin)
  ) {
    return null;
  }

  return origin;
};

export const resolvePostLoginDestination = ({ profileCompleted, storage }) => {
  const profileOrigin = getValidProfileOrigin(storage);

  if (profileCompleted === false) {
    // ProfileInfo currently completes by returning to /profile. Ensure that a
    // direct login still gives Profile a deterministic way back to the map.
    if (!profileOrigin) {
      storage?.setItem?.(PROFILE_ORIGIN_KEY, DEFAULT_MAP_PATH);
    }
    return PROFILE_INFO_PATH;
  }

  if (profileOrigin) {
    // The user explicitly requested Profile from another page. Keep the
    // origin stored so Profile's existing Back action can consume it.
    return PROFILE_PATH;
  }

  // A direct login is an app-entry flow, not a profile-entry flow.
  storage?.removeItem?.(PROFILE_ORIGIN_KEY);
  return DEFAULT_MAP_PATH;
};
