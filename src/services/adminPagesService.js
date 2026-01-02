import http from '../api/http';
import appConfig from '../config/appConfig';

const ADMIN_PAGES_BASE_URL = `${appConfig.apiBaseUrl}/api/v1/admin/pages`;

const adminPagesService = {
  getPage: async (type) => {
    const response = await http.get(`${ADMIN_PAGES_BASE_URL}/${type}`);
    return response.data;
  },
  updatePage: async (type, payload) => {
    const response = await http.put(`${ADMIN_PAGES_BASE_URL}/${type}`, payload || {});
    return response.data;
  },
  listFaqs: async () => {
    const response = await http.get(`${ADMIN_PAGES_BASE_URL}/faq`);
    return response.data;
  },
  createFaq: async (payload) => {
    const response = await http.post(`${ADMIN_PAGES_BASE_URL}/faq`, payload || {});
    return response.data;
  },
  updateFaq: async (id, payload) => {
    const response = await http.put(`${ADMIN_PAGES_BASE_URL}/faq/${id}`, payload || {});
    return response.data;
  },
  deleteFaq: async (id) => {
    await http.delete(`${ADMIN_PAGES_BASE_URL}/faq/${id}`);
  }
};

export default adminPagesService;
