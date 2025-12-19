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

const localizeField = (value, language) => {
  if (!value) return value;

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    return value[language] || value.fa || Object.values(value).find(Boolean) || '';
  }

  return '';
};

const extractCoordinates = (item) => {
  if (!item) return null;

  const directCoords = item.coordinates;
  if (Array.isArray(directCoords) && directCoords.length >= 2) {
    const [lat, lng] = directCoords;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return [lat, lng];
    }
  }

  const geo = item.geo;
  if (geo) {
    if (Array.isArray(geo) && geo.length >= 2) {
      const [lat, lng] = geo;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return [lat, lng];
      }
    }

    if (typeof geo === 'object') {
      const { lat, lng } = geo;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return [lat, lng];
      }
    }
  }

  return null;
};

const resolveGroupKey = (item) => {
  const group = item?.group ?? item?.group_id ?? item?.groupId;

  if (typeof group === 'object' && group !== null) {
    return group.value ?? group.id ?? group.key ?? undefined;
  }

  return group ?? undefined;
};

const normalizeSubGroupItem = (item, language) => ({
  ...item,
  label: localizeField(item?.label, language) || item?.value,
  address: localizeField(item?.address, language),
  description: localizeField(item?.description, language),
  coordinates: extractCoordinates(item) || undefined
});

export const normalizeSubGroupMetadata = (subGroups, language) => {
  if (!subGroups || typeof subGroups !== 'object') {
    return {};
  }

  // If the API returns an array (e.g. when requesting a single group),
  // group the items by their group identifier so consumers can still
  // access them via the expected group key.
  if (Array.isArray(subGroups)) {
    return subGroups.reduce((acc, item) => {
      const groupKey = resolveGroupKey(item);
      if (!groupKey) return acc;

      const normalizedItems = acc[groupKey] || [];
      return {
        ...acc,
        [groupKey]: [...normalizedItems, normalizeSubGroupItem(item, language)]
      };
    }, {});
  }

  return Object.entries(subGroups).reduce((acc, [groupKey, items]) => {
    const normalizedItems = Array.isArray(items)
      ? items.map((item) => normalizeSubGroupItem(item, language))
      : [];

    return {
      ...acc,
      [groupKey]: normalizedItems
    };
  }, {});
};

export default normalizeGroupMetadata;
