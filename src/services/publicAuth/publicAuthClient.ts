import publicApi, { refreshTokens as baseRefreshTokens } from './publicApi';
import { AuthTokensDTO, UserDTO } from './types';
import { clearTokens, setTokens } from './tokenStore';

export const createUser = async (payload: Partial<UserDTO> & { phone: string }) => {
  const { data } = await publicApi.post<UserDTO>('/users', payload);
  return data;
};

export const getMe = async () => {
  const { data } = await publicApi.get<UserDTO>('/auth/me');
  return data;
};

export const refresh = async (refreshToken: string) => {
  const tokens = await baseRefreshTokens(refreshToken);
  return tokens;
};

export const logout = async (refreshToken: string) => {
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
  const { data } = await publicApi.get<UserDTO>('/users/me');
  return data;
};

export const updateProfile = async (payload: Partial<UserDTO>) => {
  const { data } = await publicApi.patch<UserDTO>('/users/me', payload);
  return data;
};

export const updateProfileFallback = async (payload: Partial<UserDTO>) => {
  const { data } = await publicApi.put<UserDTO>('/users/me/profile', payload);
  return data;
};

export const applyTokens = ({ accessToken, refreshToken, expiresIn, user }: AuthTokensDTO) => {
  if (accessToken && refreshToken && expiresIn) {
    setTokens({ accessToken, refreshToken, expiresIn });
  }
  return user;
};

export default {
  createUser,
  getMe,
  refresh,
  logout,
  getProfile,
  updateProfile,
  updateProfileFallback,
  applyTokens
};
