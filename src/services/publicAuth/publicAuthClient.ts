import publicApi from './publicApi';
import { clearTokens, setTokens } from './publicTokenStore';

const createUser = async (payload: Record<string, any>) => {
  const { data } = await publicApi.post('/users', payload, { headers: { Authorization: undefined }, skipAuth: true });
  return data;
};

const me = async () => {
  const { data } = await publicApi.get('/auth/me');
  return data;
};

const refresh = async ({ refreshToken }: { refreshToken: string }) => {
  const { data } = await publicApi.post(
    '/auth/refresh',
    { refreshToken },
    { headers: { Authorization: undefined }, skipAuth: true }
  );
  if (data?.accessToken && data?.refreshToken && data?.expiresIn) {
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken, expiresIn: data.expiresIn });
  }
  return data;
};

const logout = async ({ refreshToken }: { refreshToken: string }) => {
  try {
    await publicApi.post(
      '/auth/logout',
      { refreshToken },
      {
        headers: {
          Authorization: undefined
        }
      }
    );
  } finally {
    clearTokens();
  }
};

const getProfile = async () => {
  const { data } = await publicApi.get('/users/me');
  return data;
};

const updateProfileFallback = async (payload: Record<string, any>) => {
  const { data } = await publicApi.put('/users/me/profile', payload);
  return data;
};

const updateProfile = async (payload: Record<string, any>) => {
  try {
    const { data } = await publicApi.patch('/users/me', payload);
    return data;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      const fallbackData = await updateProfileFallback(payload);
      return fallbackData;
    }
    throw error;
  }
};

const publicAuthClient = {
  createUser,
  me,
  refresh,
  logout,
  getProfile,
  updateProfile,
  updateProfileFallback
};

export { createUser, me, refresh, logout, getProfile, updateProfile, updateProfileFallback, publicAuthClient };
export default publicAuthClient;

