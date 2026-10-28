// These titles are the role identifiers used by the admin management form
// and returned by the backend's authenticated profile endpoint.
export const VIEW_ROLES = Object.freeze({
  'کاربران ثبت نام کرده': ['مدیریت کاربران ثبت نام کرده', 'مدیریت کاربران'],
  'دیدگاه ها': ['مدیریت دیدگاه ها'],
  'لاگ های مسیریابی کاربران': ['مدیریت لاگ های مسیریابی'],
  'بازخورد ها': ['مدیریت بازخورد ها'],
  'مدیریت دسته بندی‌ها': ['مدیریت دسته بندی'],
  'مدیریت صفحات': ['مدیریت صفحات'],
  'مدیریت اطلاعات فرهنگی': ['مدیریت اطلاعات فرهنگی'],
  'مدیریت ادمین‌ها': ['مدیریت ادمین ها'],
  'مدیریت نقاط راهنما': ['مدیریت نقشه']
});

export const REPORT_VIEWS = Object.freeze([
  'کاربران ثبت نام کرده', 'دیدگاه ها', 'لاگ های مسیریابی کاربران', 'بازخورد ها'
]);
export const FACILITY_VIEWS = Object.freeze([
  'مدیریت دسته بندی‌ها', 'مدیریت صفحات', 'مدیریت اطلاعات فرهنگی',
  'مدیریت ادمین‌ها', 'مدیریت نقاط راهنما'
]);

export function hasAdminRole(profile, requiredTitles) {
  if (!profile || !Array.isArray(requiredTitles) || requiredTitles.length === 0) return false;
  const titles = Array.isArray(profile.roleTitles) ? profile.roleTitles : [];
  const codes = Array.isArray(profile.roles) ? profile.roles : [];
  return codes.includes('super_dashboard_admin') || titles.includes('ادمین کل داشبورد')
    || requiredTitles.some((title) => titles.includes(title));
}

export function canOpenAdminView(profile, view) {
  return hasAdminRole(profile, VIEW_ROLES[view]);
}
