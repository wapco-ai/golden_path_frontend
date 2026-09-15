import apiUser from '../api/apiUser';
import { normalizeUserProfile } from './userProfileMapper';

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
  const formData = new FormData();
  formData.append('file', file);
  return apiUser.post('/api/v1/files/avatar', formData).then((res) => res.data);
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
