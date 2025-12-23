import apiUser from '../api/apiUser';

export const authRefresh = (refreshToken) =>
  apiUser.post('/api/v1/auth/refresh', { refreshToken }).then((res) => res.data);

export const authMe = () => apiUser.get('/api/v1/auth/me').then((res) => res.data);

export const authLogout = (refreshToken) =>
  apiUser.post('/api/v1/auth/logout', { refreshToken }).then((res) => res.data);

export const createUser = (payload) => apiUser.post('/api/v1/users', payload).then((res) => res.data);

export const getUserMe = () => apiUser.get('/api/v1/users/me').then((res) => res.data);

export const updateUserMe = (payload) => apiUser.patch('/api/v1/users/me', payload).then((res) => res.data);

export default {
  authRefresh,
  authMe,
  authLogout,
  createUser,
  getUserMe,
  updateUserMe
};
