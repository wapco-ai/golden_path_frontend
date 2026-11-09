import apiAdmin from '../api/apiAdmin';

const base = '/api/v1/admin/connectors';
const sameFloorStairsBase = '/api/v1/admin/same-floor-stairs';
export const listConnectors = async () => (await apiAdmin.get(base)).data;
export const getConnector = async (id) => (await apiAdmin.get(`${base}/${id}`)).data;
export const saveConnector = async (payload, id) => (
  id ? await apiAdmin.put(`${base}/${id}`, payload) : await apiAdmin.post(base, payload)
).data;
export const listSameFloorStairs = async (floor) => (
  await apiAdmin.get(sameFloorStairsBase, { params: { floor } })
).data;
export const listSameFloorStairAreas = async (params, signal) => (
  await apiAdmin.get(`${sameFloorStairsBase}/candidates`, { params, signal })
).data;
export const saveSameFloorStair = async (payload, id) => (
  id ? await apiAdmin.put(`${sameFloorStairsBase}/${id}`, payload) : await apiAdmin.post(sameFloorStairsBase, payload)
).data.data;
export const resolveConnectorArea = async (point) => (
  await apiAdmin.get(`${base}/candidates`, { params: point })
).data;
export const listFloors = async () => (await apiAdmin.get('/api/v1/floors')).data;
export const createDoorWithInfo = async (payload) => (
  await apiAdmin.post('/api/v1/doors/with-info', payload)
).data;
