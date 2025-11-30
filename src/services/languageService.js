import appConfig from '../config/appConfig';

export async function fetchLanguages() {
  const response = await fetch(appConfig.languagesUrl, {
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch languages');
  }

  return response.json();
}
