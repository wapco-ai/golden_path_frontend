const normalizeGroupPngPath = (group) => {
  const candidate = group?.png || group?.icon;

  if (!candidate) {
    return undefined;
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  if (candidate.startsWith('/img/')) {
    return candidate;
  }

  if (candidate.startsWith('/')) {
    return candidate;
  }

  const trimmed = candidate
    .replace(/^\/?img\//i, '')
    .replace(/^\//, '');

  const filename = /\.[a-zA-Z0-9]+$/.test(trimmed) ? trimmed : `${trimmed}.png`;

  return `/img/${filename}`;
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
