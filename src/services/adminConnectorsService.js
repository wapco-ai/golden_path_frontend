import apiAdmin from '../api/apiAdmin';

const base = '/api/v1/admin/connectors';
export const listConnectors = async () => (await apiAdmin.get(base)).data;
export const getConnector = async (id) => (await apiAdmin.get(`${base}/${id}`)).data;
export const saveConnector = async (payload, id) => (
  id ? await apiAdmin.put(`${base}/${id}`, payload) : await apiAdmin.post(base, payload)
).data;
export const resolveConnectorArea = async (point) => (
  await apiAdmin.get(`${base}/candidates`, { params: point })
).data;
export const listFloors = async () => (await apiAdmin.get('/api/v1/floors')).data;
export const createDoorWithInfo = async (payload) => (
  await apiAdmin.post('/api/v1/doors/with-info', payload)
).data;
