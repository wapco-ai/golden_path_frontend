import apiUser from '../api/apiUser';

const PUBLIC_PAGES_BASE_URL = '/api/v1/pages';

const fetchPublicPage = async (pageType, language = 'fa') => {
  const response = await apiUser.get(`${PUBLIC_PAGES_BASE_URL}/${pageType}`, {
    params: { lang: language }
  });
  return response.data;
};

export const fetchSupportPage = (language) => fetchPublicPage('support', language);
export const fetchRulesPage = (language) => fetchPublicPage('rules', language);
export const fetchAboutPage = (language) => fetchPublicPage('about', language);
export const fetchContactPage = (language) => fetchPublicPage('contact', language);
export const fetchFaqPage = (language) => fetchPublicPage('faq', language);

export default {
  fetchSupportPage,
  fetchRulesPage,
  fetchAboutPage,
  fetchContactPage,
  fetchFaqPage
};
