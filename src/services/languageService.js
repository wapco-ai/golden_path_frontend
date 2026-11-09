import appConfig from '../config/appConfig.js';

const bundledLanguages = {
  data: [
    { id: 'fa', code: 'fa', name: 'فارسی', english_name: 'Persian', direction: 'rtl' },
    { id: 'en', code: 'en', name: 'English', english_name: 'English', direction: 'ltr' },
    { id: 'ar', code: 'ar', name: 'العربية', english_name: 'Arabic', direction: 'rtl' },
    { id: 'ur', code: 'ur', name: 'اردو', english_name: 'Urdu', direction: 'rtl' }
  ], meta: { defaultLanguageId: 'fa' }
};
const valid = data => Array.isArray(data?.data) && data.data.length > 0
  && data.data.every(language => language.id && ['fa', 'en', 'ar', 'ur'].includes(language.code));

export async function fetchLanguages() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(appConfig.languagesUrl, {
      headers: { Accept: 'application/json' }, signal: controller.signal
    });
    if (!response.ok) throw new Error('Failed to fetch languages');
    const data = await response.json();
    if (!valid(data)) throw new Error('Invalid languages');
    try { localStorage.setItem('gp_languages', JSON.stringify(data)); } catch { /* Storage unavailable. */ }
    return data;
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem('gp_languages'));
      if (valid(cached)) return cached;
    } catch { /* Use the translations already bundled with the app. */ }
    return bundledLanguages;
  } finally { clearTimeout(timer); }
}
