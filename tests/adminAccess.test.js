import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_ROLE_CODES, canOpenAdminView, hasAdminRole, VIEW_ROLES } from '../src/auth/admin/adminAccess.js';

test('admin sections require a matching role from the live profile', () => {
  const mapAdmin = { roleTitles: ['مدیریت نقشه'], roles: ['manage_map'] };
  assert.equal(canOpenAdminView(mapAdmin, 'مدیریت نقاط راهنما'), true);
  for (const view of Object.keys(VIEW_ROLES).filter((view) => view !== 'مدیریت نقاط راهنما')) {
    assert.equal(canOpenAdminView(mapAdmin, view), false, view);
  }
  assert.equal(hasAdminRole(mapAdmin, ['مدیریت گزارشات']), false);
  assert.equal(canOpenAdminView({}, 'مدیریت ادمین‌ها'), false);
  assert.equal(canOpenAdminView(mapAdmin, 'unknown'), false);
});

test('dashboard administrator cannot bypass unchecked section roles', () => {
  for (const profile of [{ roles: ['super_dashboard_admin'] }, { roleTitles: ['ادمین کل داشبورد'] }]) {
    for (const view of Object.keys(VIEW_ROLES)) assert.equal(canOpenAdminView(profile, view), false);
    assert.equal(hasAdminRole(profile, ['مدیریت گزارشات']), false);
    assert.equal(hasAdminRole(profile, ['ادمین کل داشبورد']), true);
    assert.equal(canOpenAdminView(profile, 'unknown'), false);
  }
});

test('each canonical role code grants exactly its matching title', () => {
  for (const [title, code] of Object.entries(ADMIN_ROLE_CODES)) {
    for (const requested of Object.keys(ADMIN_ROLE_CODES)) {
      assert.equal(hasAdminRole({ roles: [code] }, [requested]), requested === title, `${code}: ${requested}`);
    }
  }
});

test('screenshot role selection removes map and category access but retains registered-users access', () => {
  const titles = Object.keys(ADMIN_ROLE_CODES).filter(title => !['مدیریت کاربران', 'مدیریت نقشه', 'مدیریت دسته بندی'].includes(title));
  for (const profile of [{ roleTitles: titles }, { roles: titles.map(title => ADMIN_ROLE_CODES[title]) }]) {
    assert.equal(hasAdminRole(profile, ['مدیریت نقشه']), false);
    assert.equal(hasAdminRole(profile, ['مدیریت کاربران']), false);
    assert.equal(canOpenAdminView(profile, 'مدیریت دسته بندی‌ها'), false);
    assert.equal(canOpenAdminView(profile, 'مدیریت نقاط راهنما'), false);
    assert.equal(canOpenAdminView(profile, 'کاربران ثبت نام کرده'), true);
    assert.equal(canOpenAdminView(profile, 'مدیریت ادمین‌ها'), true);
  }
  assert.equal(canOpenAdminView({ roleTitles: ['مدیریت کاربران'] }, 'کاربران ثبت نام کرده'), true);
});
