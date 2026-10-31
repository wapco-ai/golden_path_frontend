// These titles are the role identifiers used by the admin management form
// and returned by the backend's authenticated profile endpoint.
export const ADMIN_ROLE_CODES = Object.freeze({
  'ادمین کل داشبورد': 'super_dashboard_admin',
  'مدیریت کاربران': 'manage_users',
  'مدیریت نقشه': 'manage_map',
  'مدیریت دسته بندی': 'manage_categories',
  'مدیریت اطلاعات فرهنگی': 'manage_cultural_items',
  'مدیریت ادمین ها': 'manage_admins',
  'مدیریت گزارشات': 'manage_reports',
  'مدیریت صفحات': 'manage_pages',
  'مدیریت بازخورد ها': 'manage_support_feedbacks',
  'مدیریت دیدگاه ها': 'manage_comments',
  'مدیریت لاگ های مسیریابی': 'manage_routing_logs',
  'مدیریت کاربران ثبت نام کرده': 'manage_registered_users'
});

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
  // Dashboard access is a separate grant, not an override for unchecked sections.
  return requiredTitles.some((title) => titles.includes(title)
    || (ADMIN_ROLE_CODES[title] && codes.includes(ADMIN_ROLE_CODES[title])));
}

export function canOpenAdminView(profile, view) {
  return hasAdminRole(profile, VIEW_ROLES[view]);
}
