import http from '../api/http';

const DASHBOARD_BASE_URL = '/api/v1/admin/dashboard';

export const fetchDashboardSummary = async () => {
  const response = await http.get(`${DASHBOARD_BASE_URL}/summary`);
  return response.data;
};

export const fetchDashboardUserVisits = async ({ range = 'week' } = {}) => {
  const response = await http.get(`${DASHBOARD_BASE_URL}/user-visits`, { params: { range } });
  return response.data;
};

export const fetchDashboardCommentStats = async ({ range = 'week' } = {}) => {
  const response = await http.get(`${DASHBOARD_BASE_URL}/comment-stats`, { params: { range } });
  return response.data;
};

export const fetchDashboardNotifications = async ({ limit = 10, unreadOnly = false } = {}) => {
  const response = await http.get(`${DASHBOARD_BASE_URL}/notifications`, { params: { limit, unreadOnly } });
  return response.data;
};

export const fetchDashboardRecentUsers = async ({ page = 1, pageSize = 10, search = '' } = {}) => {
  const response = await http.get(`${DASHBOARD_BASE_URL}/recent-users`, { params: { page, pageSize, search } });
  return response.data;
};

const adminDashboardService = {
  fetchDashboardSummary,
  fetchDashboardUserVisits,
  fetchDashboardCommentStats,
  fetchDashboardNotifications,
  fetchDashboardRecentUsers
};

export default adminDashboardService;
