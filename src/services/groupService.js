import appConfig from '../config/appConfig';

export async function fetchGroupMetadata({
  language = 'fa',
  only,
  withPng = true,
  includeSubGroups = true,
  withImages
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

  if (typeof includeSubGroups !== 'undefined') {
    params.set('includeSubGroups', includeSubGroups ? 'true' : 'false');
  }

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
    throw new Error('Failed to fetch group metadata');
  }

  return response.json();
}
