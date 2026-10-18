import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import {
  normalizeDashboardNotifications,
  buildNotificationGroups
} from '../src/utils/adminNotifications.js';

const HOUR_MS = 60 * 60 * 1000;
const now = Date.parse('2026-10-18T12:00:00Z');
const item = (id, ageHours = 1, extra = {}) => ({
  id,
  type: 'new_comment',
  createdAt: new Date(now - ageHours * HOUR_MS).toISOString(),
  read: false,
  ...extra
});

test('accepts metadata, bare arrays and legacy data wrappers while preserving global unread count', () => {
  const source = [item('a'), item('b', 2, { read: true })];
  assert.equal(normalizeDashboardNotifications(source).unreadCount, 1);
  assert.deepEqual(normalizeDashboardNotifications({ data: source }).items,
    normalizeDashboardNotifications(source).items);
  assert.equal(normalizeDashboardNotifications({ items: source, unreadCount: 43 }).unreadCount, 43);
  assert.equal(normalizeDashboardNotifications({ items: [], unreadCount: 43 }).unreadCount, 43);
  assert.equal(normalizeDashboardNotifications({ items: source, unreadCount: 0 }).unreadCount, 0);
  for (const invalidCount of [-1, 1.5, '43', null, undefined]) {
    assert.equal(normalizeDashboardNotifications({ items: source, unreadCount: invalidCount }).unreadCount, 1);
  }
  for (const empty of [null, undefined, {}, { data: null }]) {
    assert.deepEqual(normalizeDashboardNotifications(empty), { items: [], unreadCount: 0 });
  }
});

test('keeps API IDs and fields, maps documented types and uses acknowledgement-safe stable fallback IDs', () => {
  const source = [
    item('new_comment:8', 1, { entityId: 8, title: 'دیدگاه', message: 'متن', extra: 'retained' }),
    item(null, 2, { type: 'user', entityId: 8 }),
    item(undefined, 3, { type: 'support_message', entityId: '9' }),
    item(10, 4, { type: 'feedback' }),
    item('', 5, { type: 'comment', entityId: '9223372036854775807' })
  ];
  const { items } = normalizeDashboardNotifications(source);
  assert.deepEqual(items.map(({ id, type }) => [id, type]), [
    ['new_comment:8', 'comment'], ['new_user:8', 'user'],
    ['support_message:9', 'feedback'], ['10', 'feedback'], ['new_comment:9223372036854775807', 'comment']
  ]);
  assert.equal(items[0].extra, 'retained');
  assert.equal(items[0].title, 'دیدگاه');
  assert.equal(items[0].message, 'متن');
  const changedDate = normalizeDashboardNotifications([{
    ...source[1], createdAt: '2020-01-01T00:00:00Z'
  }]).items[0];
  assert.equal(changedDate.id, items[1].id);
  assert.deepEqual(normalizeDashboardNotifications([
    item(undefined, 1, { entityId: null }), item('unsupported', 1, { type: 'unknown' })
  ]).items, []);
  for (const entityId of [0, -1, 1.5, 'abc', '9223372036854775808', Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(normalizeDashboardNotifications([item(undefined, 1, { entityId })]).items, []);
  }
});

test('normalizes ISO offsets and timezone-less legacy timestamps as UTC without changing future instants', () => {
  const { items } = normalizeDashboardNotifications([
    item('legacy-space', 1, { createdAt: '2026-10-18 08:30:00' }),
    item('legacy-t', 1, { createdAt: '2026-10-18T08:30:00' }),
    item('offset', 1, { createdAt: '2026-10-18T12:00:00+03:30' }),
    item('future', 1, { createdAt: '2026-10-18T13:00:00Z' }),
    item('legacy-time', 1, { createdAt: undefined, time: '2026-10-18T08:30:00Z' })
  ]);
  assert.equal(items[0].id, 'future');
  assert.equal(items[0].createdAt, '2026-10-18T13:00:00.000Z');
  assert.ok(items.slice(1).every(({ createdAt }) => createdAt === '2026-10-18T08:30:00.000Z'));
});

test('excludes missing, malformed and calendar-invalid dates rather than inventing recent notifications', () => {
  const invalid = [null, undefined, '', 'invalid', '2026-02-30T10:00:00Z',
    '2026-13-01T00:00:00Z', '2026-01-01T24:00:00Z', '2026-01-01T00:60:00Z'];
  const source = invalid.map((createdAt, index) => item(`invalid-${index}`, 1, { createdAt }));
  assert.deepEqual(normalizeDashboardNotifications(source), { items: [], unreadCount: 0 });
  assert.deepEqual(buildNotificationGroups(source, { now }), []);
  assert.equal(normalizeDashboardNotifications({ items: source, unreadCount: 14 }).unreadCount, 14);
  assert.equal(normalizeDashboardNotifications([item('leap', 1, {
    createdAt: '2024-02-29T10:00:00.123456Z'
  })]).items[0].createdAt, '2024-02-29T10:00:00.123Z');
});

test('deduplicates stable IDs and normalizes read flags before counting and grouping', () => {
  const source = [item('duplicate'), item('duplicate'),
    item('read-bool', 2, { read: true }), item('read-int', 2, { read: 1 }),
    item('read-string', 2, { read: 'true' }), item('unread-string', 2, { read: 'false' })];
  const normalized = normalizeDashboardNotifications(source);
  assert.equal(normalized.items.length, 5);
  assert.equal(normalized.unreadCount, 2);
  const groups = buildNotificationGroups(normalized.items, { now });
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].ids, ['duplicate', 'unread-string']);
  assert.equal(groups[0].count, 2);
  assert.equal(groups[0].unreadCount, 2);
  assert.deepEqual(buildNotificationGroups([item('read', 1, { read: true })], { now }), []);
});

test('covers exact 12, 24 and 48 hour boundaries and keeps at-now and future notifications visible', () => {
  const boundaryItems = [item('future', -1), item('now', 0), item('12h', 12),
    item('after12h', 12 + 1 / HOUR_MS), item('24h', 24),
    item('after24h', 24 + 1 / HOUR_MS), item('48h', 48),
    item('after48h', 48 + 1 / HOUR_MS)];
  const groups = buildNotificationGroups(boundaryItems, { now });
  assert.deepEqual(groups.map(({ period, ids }) => [period, ids]), [
    ['last12Hours', ['future', 'now', '12h']],
    ['12to24Hours', ['after12h', '24h']],
    ['24to48Hours', ['after24h', '48h']],
    ['older', ['after48h']]
  ]);
  assert.deepEqual(groups.slice(0, 3).map(({ timeText }) => timeText), ['12 ساعت گذشته', 'دیروز', 'پریروز']);
  assert.equal(groups.reduce((count, group) => count + group.count, 0), boundaryItems.length);
});

test('groups only unread records in the original type order with member IDs newest first', () => {
  const groups = buildNotificationGroups([
    item('old-comment', 30), item('read-feedback', 1, { type: 'feedback', read: true }),
    item('new-feedback', 2, { type: 'support_message' }), item('new-user', 1, { type: 'new_user' }),
    item('comment-2', 4), item('comment-1', 3), item('yesterday-user', 14, { type: 'user' })
  ], { now });
  assert.deepEqual(groups.map(({ type, period, ids }) => [type, period, ids]), [
    ['comment', 'last12Hours', ['comment-1', 'comment-2']],
    ['feedback', 'last12Hours', ['new-feedback']],
    ['user', 'last12Hours', ['new-user']],
    ['user', '12to24Hours', ['yesterday-user']],
    ['comment', '24to48Hours', ['old-comment']]
  ]);
  assert.ok(groups.every((group) => group.count === group.unreadCount && group.count === group.ids.length));
});

test('uses Tehran Jalali date boundaries and sorts older date groups by actual timestamps', () => {
  const source = [
    item('oldest', 1, { createdAt: '2026-10-12T12:00:00Z' }),
    item('before-midnight', 1, { createdAt: '2026-10-15T20:29:59.999Z' }),
    item('after-midnight', 1, { createdAt: '2026-10-15T20:30:00.000Z' })
  ];
  const groups = buildNotificationGroups(source, { now: '2026-10-20T00:00:00Z' });
  assert.deepEqual(groups.map(({ timeText, ids }) => [timeText, ids]), [
    ['24 مهر 1405', ['after-midnight']],
    ['23 مهر 1405', ['before-midnight']],
    ['20 مهر 1405', ['oldest']]
  ]);
  assert.ok(groups.every(({ period }) => period === 'older'));
});

test('orders older days chronologically before applying comment, feedback, user within each day', () => {
  const source = [
    item('old-user', 1, { type: 'user', createdAt: '2026-10-14T14:00:00Z' }),
    item('new-user', 1, { type: 'user', createdAt: '2026-10-15T14:00:00Z' }),
    item('old-comment', 1, { type: 'comment', createdAt: '2026-10-14T12:00:00Z' }),
    item('new-comment', 1, { type: 'comment', createdAt: '2026-10-15T12:00:00Z' }),
    item('old-feedback', 1, { type: 'feedback', createdAt: '2026-10-14T13:00:00Z' }),
    item('new-feedback', 1, { type: 'feedback', createdAt: '2026-10-15T13:00:00Z' })
  ];
  const normalized = normalizeDashboardNotifications(source);
  assert.deepEqual(normalized.items.map(({ id }) => id), [
    'new-user', 'new-feedback', 'new-comment', 'old-user', 'old-feedback', 'old-comment'
  ]);
  const groups = buildNotificationGroups(normalized.items, { now });
  assert.deepEqual(groups.map(({ timeText, type, ids }) => [timeText, type, ids]), [
    ['23 مهر 1405', 'comment', ['new-comment']],
    ['23 مهر 1405', 'feedback', ['new-feedback']],
    ['23 مهر 1405', 'user', ['new-user']],
    ['22 مهر 1405', 'comment', ['old-comment']],
    ['22 مهر 1405', 'feedback', ['old-feedback']],
    ['22 مهر 1405', 'user', ['old-user']]
  ]);
});

test('parsing and Tehran grouping do not depend on the host time zone', () => {
  const helperUrl = new URL('../src/utils/adminNotifications.js', import.meta.url).href;
  const script = `import {normalizeDashboardNotifications,buildNotificationGroups} from ${JSON.stringify(helperUrl)};
    const data=normalizeDashboardNotifications([{id:'a',type:'new_user',createdAt:'2026-10-15 20:30:00',read:false}]);
    process.stdout.write(JSON.stringify({data,groups:buildNotificationGroups(data.items,{now:'2026-10-20T00:00:00Z'})}));`;
  const runInTimeZone = (timeZone) => execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, TZ: timeZone }, encoding: 'utf8'
  });
  const utc = runInTimeZone('UTC');
  assert.equal(runInTimeZone('America/Los_Angeles'), utc);
  assert.equal(runInTimeZone('Asia/Tehran'), utc);
  assert.equal(JSON.parse(utc).groups[0].timeText, '24 مهر 1405');
});
