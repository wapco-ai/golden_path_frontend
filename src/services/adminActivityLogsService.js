import http from '../api/http';

export async function fetchAdminActivityLogs(params, signal) {
  const response = await http.get('/api/v1/admin/activity-logs', { params, signal });
  return response.data;
}
