import appConfig from '../config/appConfig';

export async function fetchGroupMetadata({ language = 'fa', only, withPng = true } = {}) {
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
