import http from './http';
import appConfig from '../config/appConfig';

export const fetchSignedUsers = async ({ page = 1, pageSize = 20, search = '' }) => {
  const params = {
    page,
    pageSize
  };

  if (search) {
    params.search = search;
  }

  const response = await http.get(appConfig.adminUsersBaseUrl, { params });
  return response.data;
};

export const fetchSignedUser = async (id) => {
  const response = await http.get(`${appConfig.adminUsersBaseUrl}/${id}`);
  return response.data;
};

export const updateSignedUserStatus = async (id, status) => {
  const response = await http.patch(`${appConfig.adminUsersBaseUrl}/${id}/status`, { status });
  return response.data;
};
