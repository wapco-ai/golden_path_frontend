import appConfig from '../config/appConfig';
import apiUser from '../api/apiUser';

const request = async (config) => {
  try {
    const response = await apiUser(config);
    return response?.data || {};
  } catch (error) {
    const data = error?.response?.data || {};
    error.code = data?.code || error?.code || null;
    error.status = error?.response?.status || error?.status || null;
    if (data?.message) error.message = data.message;
    throw error;
  }
};

export const createLocationShare = async ({ recipientPhone, lat, lng, floor, accuracyM }) => {
  const data = await request({
    url: appConfig.locationSharesUrl,
    method: 'POST',
    data: { recipientPhone, lat, lng, floor, accuracyM }
  });

  return data?.share || data;
};

export const listIncomingLocationShares = async ({ signal } = {}) => {
  const data = await request({
    url: `${appConfig.locationSharesUrl}/incoming`,
    method: 'GET',
    signal
  });
  return Array.isArray(data?.items) ? data.items : [];
};

export const listOutgoingLocationShares = async ({ signal } = {}) => {
  const data = await request({
    url: `${appConfig.locationSharesUrl}/outgoing`,
    method: 'GET',
    signal
  });
  return Array.isArray(data?.items) ? data.items : [];
};

export const revokeLocationShare = async (id) => request({
  url: `${appConfig.locationSharesUrl}/${encodeURIComponent(id)}`,
  method: 'DELETE'
});
