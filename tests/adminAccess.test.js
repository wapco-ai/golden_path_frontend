import assert from 'node:assert/strict';
import test from 'node:test';
import { canOpenAdminView, hasAdminRole, VIEW_ROLES } from '../src/auth/admin/adminAccess.js';

test('admin sections require a matching role from the live profile', () => {
  const mapAdmin = { roleTitles: ['مدیریت نقشه'], roles: ['map_admin'] };
  assert.equal(canOpenAdminView(mapAdmin, 'مدیریت نقاط راهنما'), true);
  for (const view of Object.keys(VIEW_ROLES).filter((view) => view !== 'مدیریت نقاط راهنما')) {
    assert.equal(canOpenAdminView(mapAdmin, view), false, view);
  }
  assert.equal(hasAdminRole(mapAdmin, ['مدیریت گزارشات']), false);
  assert.equal(canOpenAdminView({}, 'مدیریت ادمین‌ها'), false);
  assert.equal(canOpenAdminView(mapAdmin, 'unknown'), false);
});

test('super administrator can access all known sections; legacy user-manager can access signed users', () => {
  for (const profile of [{ roles: ['super_dashboard_admin'] }, { roleTitles: ['ادمین کل داشبورد'] }]) {
    for (const view of Object.keys(VIEW_ROLES)) assert.equal(canOpenAdminView(profile, view), true);
    assert.equal(hasAdminRole(profile, ['مدیریت گزارشات']), true);
    assert.equal(canOpenAdminView(profile, 'unknown'), false);
  }
  assert.equal(canOpenAdminView({ roleTitles: ['مدیریت کاربران'] }, 'کاربران ثبت نام کرده'), true);
});
