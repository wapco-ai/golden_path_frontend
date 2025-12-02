import appConfig from '../config/appConfig';

export async function fetchGroupMetadata({
  language = 'fa',
  only,
  withPng = true
} = {}) {
  const url = new URL(appConfig.groupMetadataUrl);
  const params = new URLSearchParams();

  if (language) {
    params.set('language', language);
  }

  if (typeof withPng !== 'undefined') {
    params.set('withPng', withPng ? 'true' : 'false');
  }

  if (only) {
    params.set('only', only);
  }

  url.search = params.toString();

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch group metadata');
  }

  return response.json();
}

export async function fetchSubGroups({
  language = 'fa',
  groups,
  search,
  limit = 50,
  offset = 0,
  withImages = true
} = {}) {
  const url = new URL(appConfig.groupSubGroupsUrl);
  const params = new URLSearchParams();

  if (language) {
    params.set('language', language);
  }

  if (groups) {
    const groupList = Array.isArray(groups) ? groups : [groups];
    groupList.filter(Boolean).forEach((group) => {
      params.append('group', group);
    });
  }

  if (search) {
    params.set('search', search);
  }

  const numericLimit = Number(limit);
  const safeLimit = Number.isFinite(numericLimit)
    ? Math.max(1, Math.min(200, numericLimit))
    : 50;
  params.set('limit', safeLimit.toString());

  const numericOffset = Number(offset);
  const safeOffset = Number.isFinite(numericOffset) ? Math.max(0, numericOffset) : 0;
  params.set('offset', safeOffset.toString());

  if (typeof withImages !== 'undefined') {
    params.set('withImages', withImages ? 'true' : 'false');
  }

  url.search = params.toString();

  const response = await fetch(url.toString(), {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch sub group metadata');
  }

  return response.json();
}
