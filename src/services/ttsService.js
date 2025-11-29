import appConfig from '../config/appConfig';

const AUTH_URL = appConfig.ttsAuthUrl;
const TTS_URL = appConfig.ttsRequestUrl;

let cachedToken = null;
let tokenExpiry = 0;

const username = import.meta.env.VITE_TTS_USERNAME;
const password = import.meta.env.VITE_TTS_PASSWORD;
const clientId = import.meta.env.VITE_TTS_CLIENT_ID;

const ensureCredentials = () => {
  if (!username || !password || !clientId) {
    throw new Error('Missing TTS credentials');
  }
};

const requestToken = async () => {
  ensureCredentials();

  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username,
      password,
      client_id: clientId,
      grant_type: 'password'
    })
  });

  if (!response.ok) {
    throw new Error(`Authentication failed with status ${response.status}`);
  }

  const data = await response.json();
  const token = data.access || data.access_token || data.token;
  const expiresIn = data.expires_in || data.expire_in || 300;

  if (!token) {
    throw new Error('Authentication response missing access token');
  }

  cachedToken = token;
  tokenExpiry = Date.now() + (expiresIn - 5) * 1000;
  return cachedToken;
};

const getToken = async () => {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  cachedToken = null;
  return requestToken();
};

const fetchSpeech = async (text, payload = {}) => {
  if (!text || !text.trim()) {
    throw new Error('No text provided for TTS');
  }

  let token = await getToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const formData = new FormData();
    formData.append('input_text', text);
    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
    });

    const response = await fetch(TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (response.status === 401 && attempt === 0) {
      cachedToken = null;
      tokenExpiry = 0;
      token = await getToken();
      continue;
    }

    if (!response.ok) {
      let errorMessage = `TTS request failed with status ${response.status}`;
      try {
        const errorContentType = response.headers.get('content-type') || '';
        if (errorContentType.includes('application/json')) {
          const errorBody = await response.json();
          if (errorBody?.detail) {
            errorMessage = Array.isArray(errorBody.detail)
              ? errorBody.detail.map(item => item.msg || item).join(', ')
              : errorBody.detail;
          } else if (errorBody?.message) {
            errorMessage = errorBody.message;
          }
        }
      } catch (parseError) {
        // Ignore JSON parse errors and fall back to default message
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (data?.file) {
        const base64Content = data.file.startsWith('data:')
          ? data.file.split(',')[1]
          : data.file;
        const byteCharacters = atob(base64Content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i += 1) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: data.mime_type || 'audio/wav' });
      }

      if (data?.file_url) {
        const fileResponse = await fetch(data.file_url);
        if (!fileResponse.ok) {
          throw new Error('Failed to download TTS audio file');
        }
        return fileResponse.blob();
      }

      throw new Error('Unexpected TTS response format');
    }

    return response.blob();
  }

  throw new Error('Unauthorized TTS request');
};

export default {
  fetchSpeech
};
