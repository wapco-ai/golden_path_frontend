const MANUAL_FLOOR_PATHS = new Set(['/fs', '/mpr', '/mpb']);

const normalizePathname = (pathname) => {
  if (typeof pathname !== 'string') return '';
  const trimmed = pathname.trim();
  if (!trimmed) return '';
  const withoutTrailingSlash = trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : trimmed;
  return withoutTrailingSlash.toLowerCase();
};

export const canUserSelectMapFloor = (pathname) => MANUAL_FLOOR_PATHS.has(normalizePathname(pathname));

export const manualFloorPaths = Object.freeze(Array.from(MANUAL_FLOOR_PATHS));

export default canUserSelectMapFloor;
