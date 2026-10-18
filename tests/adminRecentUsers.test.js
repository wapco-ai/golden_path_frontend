import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { formatRecentUserBirthDate, formatRecentUserDateTime, normalizeRecentUser } from '../src/utils/adminRecentUsers.js';

test('keeps each recent user’s actual birthday and profile fields without modifying the API records', () => {
  const input = [
    { id: 1, name: 'کاربر اول', mobile: '09120000001', birthDate: '1990-01-01', email: 'first@example.com', province: 'تهران', city: 'تهران', gender: 'male', joinDate: '2025-12-23T09:00:00Z', lastLoginAt: '2026-10-18T12:00:00Z', successCount: 3, savedRoutesCount: null, placeVisitsCount: null },
    { id: 2, name: 'کاربر دوم', mobile: '09120000002', birthDate: '2000-12-31', email: 'second@example.com', province: 'اصفهان', city: 'کاشان', gender: 'female', joinDate: '2026-10-18T09:00:00Z', lastLoginAt: null, successCount: 0, savedRoutesCount: null, placeVisitsCount: null }
  ];
  const before = structuredClone(input);
  const [first, second] = input.map(normalizeRecentUser);
  assert.equal(first.birthDate, '۱۳۶۸/۱۰/۱۱');
  assert.equal(second.birthDate, '۱۳۷۹/۱۰/۱۱');
  assert.equal(first.email, 'first@example.com');
  assert.equal(second.email, 'second@example.com');
  assert.equal(first.province, 'تهران');
  assert.equal(second.city, 'کاشان');
  assert.notEqual(first.registerDate, second.registerDate);
  assert.equal(first.lastLogin, '۱۴۰۵/۰۷/۲۶, ۱۵:۳۰:۰۰');
  assert.equal(second.lastLogin, null);
  assert.deepEqual(input, before);
});

test('shows no fabricated profile values or statistics when they are absent', () => {
  const user = normalizeRecentUser({ id: 4, name: 'کاربر فاقد اطلاعات' });
  for (const key of ['birthDate', 'email', 'province', 'city', 'registerDate', 'lastLogin', 'successCount', 'savedRoutesCount', 'placeVisitsCount']) {
    assert.equal(user[key], null, key);
  }
  assert.equal(user.phone, '-');
  assert.equal(user.gender, '-');
  assert.deepEqual(normalizeRecentUser(null), normalizeRecentUser({}));
});

test('maps the API mobile field and retains the previous phone alias and row identifiers', () => {
  assert.equal(normalizeRecentUser({ id: 9, mobile: '09121111111', phone: '09122222222' }).phone, '09121111111');
  assert.equal(normalizeRecentUser({ id: 9, phone: '09122222222' }).phone, '09122222222');
  assert.equal(normalizeRecentUser({ id: 9 }).id, 9);
  assert.equal(normalizeRecentUser({}, 5).id, 5);
  assert.equal(normalizeRecentUser({ fullName: 'نام واقعی' }).fullName, 'نام واقعی');
});

test('localizes gender enums without changing already localized values', () => {
  for (const [input, expected] of [['male', 'مرد'], ['female', 'زن'], ['other', 'سایر'], ['مرد', 'مرد'], [null, '-']]) {
    assert.equal(normalizeRecentUser({ gender: input }).gender, expected);
  }
});

test('preserves real zero counts and accepts only nonnegative integer statistics', () => {
  for (const value of [0, '0', 12, '12']) {
    const user = normalizeRecentUser({ successCount: value, savedRoutesCount: value, placeVisitsCount: value });
    assert.equal(user.successCount, Number(value));
    assert.equal(user.savedRoutesCount, Number(value));
    assert.equal(user.placeVisitsCount, Number(value));
  }
  for (const value of [null, undefined, '', ' ', false, -1, '-1', 1.5, '1.5', 'garbage', Number.MAX_SAFE_INTEGER + 1]) {
    const user = normalizeRecentUser({ successCount: value, savedRoutesCount: value, placeVisitsCount: value });
    assert.equal(user.successCount, null, String(value));
    assert.equal(user.savedRoutesCount, null, String(value));
    assert.equal(user.placeVisitsCount, null, String(value));
  }
});

test('formats real registration and last-login instants in Tehran across the day boundary', () => {
  assert.equal(formatRecentUserDateTime('2025-12-22T20:29:59Z'), '۱۴۰۴/۱۰/۰۱, ۲۳:۵۹:۵۹');
  assert.equal(formatRecentUserDateTime('2025-12-22T20:30:00Z'), '۱۴۰۴/۱۰/۰۲, ۰۰:۰۰:۰۰');
  assert.equal(formatRecentUserDateTime('2025-12-23T00:30:00+03:30'), '۱۴۰۴/۱۰/۰۲, ۰۰:۳۰:۰۰');
  assert.equal(formatRecentUserDateTime('2025-12-22T21:00:00Z'), '۱۴۰۴/۱۰/۰۲, ۰۰:۳۰:۰۰');
});

test('interprets legacy naive SQL and ISO timestamps as UTC, including microseconds', () => {
  const expected = formatRecentUserDateTime('2025-12-22T21:00:00Z');
  assert.equal(formatRecentUserDateTime('2025-12-22 21:00:00'), expected);
  assert.equal(formatRecentUserDateTime('2025-12-22T21:00:00'), expected);
  assert.equal(formatRecentUserDateTime('2025-12-22 21:00:00.123456'), expected);
  assert.equal(formatRecentUserDateTime('2025-12-22T21:00:00.123456Z'), expected);
});

test('rejects missing or invalid dates instead of displaying invented dates or rolling the calendar', () => {
  for (const value of [undefined, null, '', ' ', false, 0, {}, 'invalid', '2025-02-29', '2024-02-30', '2026-13-01', '0000-01-01']) {
    assert.equal(formatRecentUserBirthDate(value), null, String(value));
    assert.equal(formatRecentUserDateTime(value), null, String(value));
  }
  for (const value of ['2025-02-29T00:00:00Z', '2026-10-18T24:00:00Z', '2026-10-18T12:60:00Z', '2026-10-18T12:00:60Z', '2026-10-18T12:00:00+24:00']) {
    assert.equal(formatRecentUserDateTime(value), null, value);
  }
  assert.equal(formatRecentUserBirthDate('2024-02-29'), '۱۴۰۲/۱۲/۱۰');
  assert.equal(formatRecentUserBirthDate('1990-01-01T00:00:00Z'), null);
});

test('birthday and registration display are independent of the administrator’s browser time zone', () => {
  const moduleUrl = new URL('../src/utils/adminRecentUsers.js', import.meta.url).href;
  const script = `import {formatRecentUserBirthDate, formatRecentUserDateTime} from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify([formatRecentUserBirthDate('1990-01-01'), formatRecentUserBirthDate('2000-12-31'), formatRecentUserDateTime('2025-12-22 21:00:00'), formatRecentUserDateTime('2025-12-22T21:00:00Z')]));`;
  const values = ['UTC', 'America/Los_Angeles', 'Asia/Tehran'].map(TZ => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' })));
  assert.deepEqual(values[0], ['۱۳۶۸/۱۰/۱۱', '۱۳۷۹/۱۰/۱۱', '۱۴۰۴/۱۰/۰۲, ۰۰:۳۰:۰۰', '۱۴۰۴/۱۰/۰۲, ۰۰:۳۰:۰۰']);
  assert.deepEqual(values[1], values[0]);
  assert.deepEqual(values[2], values[0]);
});
