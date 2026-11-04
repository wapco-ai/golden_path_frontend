import apiUser from '../api/apiUser';
import { isSameUserSession, useUserAuthStore } from '../auth/user/userAuthStore';
import { normalizeUserProfile, resolveAvatarUrl } from './userProfileMapper';

export const authRefresh = (refreshToken) =>
  apiUser.post('/api/v1/auth/refresh', { refreshToken }).then((res) => ({
    ...res.data,
    user: res.data?.user ? normalizeUserProfile(res.data.user) : res.data?.user
  }));

export const authMe = () =>
  apiUser.get('/api/v1/auth/me').then((res) => normalizeUserProfile(res.data));

export const authLogout = (refreshToken) =>
  apiUser.post('/api/v1/auth/logout', { refreshToken }).then((res) => res.data);

export const createUser = (payload) =>
  apiUser.post('/api/v1/users', payload).then((res) => normalizeUserProfile(res.data));

export const getUserMe = () =>
  apiUser.get('/api/v1/users/me').then((res) => normalizeUserProfile(res.data));

export const updateUserMe = (payload) =>
  apiUser.patch('/api/v1/users/me', payload).then((res) => normalizeUserProfile(res.data));

export const uploadUserAvatar = (file) => {
  const session = useUserAuthStore.getState();
  const formData = new FormData();
  formData.append('file', file);
  return apiUser.post('/api/v1/files/avatar', formData, { _userSession: session }).then((res) => {
    const current = useUserAuthStore.getState();
    if (!isSameUserSession(session, current)) throw new Error('User session changed during avatar upload');
    const url = resolveAvatarUrl(res.data?.url);
    if (!url) throw new Error('Invalid avatar URL');
    useUserAuthStore.setState({ user: { ...current.user, avatar: url, avatarUrl: url } });
    return url;
  });
};

export default {
  authRefresh,
  authMe,
  authLogout,
  createUser,
  getUserMe,
  updateUserMe,
  uploadUserAvatar
};
