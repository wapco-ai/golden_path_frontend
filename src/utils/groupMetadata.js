const basePath = (import.meta?.env?.BASE_URL || '/').replace(/\/$/, '');

const withBasePath = (path) => {
  if (!path || /^https?:\/\//i.test(path)) {
    return path;
  }

  if (!basePath) {
    return path;
  }

  if (path === basePath || path.startsWith(`${basePath}/`)) {
    return path;
  }

  return `${basePath}${path.startsWith('/') ? path : `/${path}`}`;
};

const normalizeGroupPngPath = (group) => {
  const candidate = group?.png || group?.icon;

  if (!candidate) {
    return undefined;
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  if (candidate.startsWith('/img/')) {
    return withBasePath(candidate);
  }

  if (candidate.startsWith('/')) {
    return withBasePath(candidate);
  }

  const trimmed = candidate
    .replace(/^\/?img\//i, '')
    .replace(/^\//, '');

  const filename = /\.[a-zA-Z0-9]+$/.test(trimmed) ? trimmed : `${trimmed}.png`;

  return withBasePath(`/assets/icons/${filename}`);
};

export const normalizeGroupMetadata = (groups, language) => {
  const metadataGroups = Array.isArray(groups) ? groups : [];

  return metadataGroups.map((group) => ({
    ...group,
    label: group.label?.[language] || group.label?.fa || group.value,
    png: normalizeGroupPngPath(group)
  }));
};

export default normalizeGroupMetadata;
