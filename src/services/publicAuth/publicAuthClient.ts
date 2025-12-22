import publicApi from './publicApi';
import { clearTokens, setTokens } from './publicTokenStore';

export const createUser = async (payload: Record<string, any>) => {
  const { data } = await publicApi.post('/users', payload, { headers: { Authorization: undefined }, skipAuth: true });
  return data;
};

export const me = async () => {
  const { data } = await publicApi.get('/auth/me');
  return data;
};

export const refresh = async ({ refreshToken }: { refreshToken: string }) => {
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

export const logout = async ({ refreshToken }: { refreshToken: string }) => {
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

export const getProfile = async () => {
  const { data } = await publicApi.get('/users/me');
  return data;
};

export const updateProfile = async (payload: Record<string, any>) => {
  try {
    const { data } = await publicApi.patch('/users/me', payload);
    return data;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      const { data } = await publicApi.put('/users/me/profile', payload);
      return data;
    }
    throw error;
  }
};

export {
  createUser,
  me,
  refresh,
  logout,
  getProfile,
  updateProfile
};
