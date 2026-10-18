const HOUR_MS = 60 * 60 * 1000;
const PERIOD_ORDER = ['last12Hours', '12to24Hours', '24to48Hours', 'older'];
const TYPE_ORDER = ['comment', 'feedback', 'user'];

const notificationTypes = {
  new_comment: { type: 'comment', apiType: 'new_comment' },
  comment: { type: 'comment', apiType: 'new_comment' },
  new_user: { type: 'user', apiType: 'new_user' },
  user: { type: 'user', apiType: 'new_user' },
  support_message: { type: 'feedback', apiType: 'support_message' },
  feedback: { type: 'feedback', apiType: 'support_message' }
};

const tehranJalaliFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

const stableId = (value) => {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const positiveEntityId = (value) => {
  const id = stableId(value);
  if (!id || !/^[1-9]\d*$/.test(id)) return null;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  return BigInt(id) <= 9223372036854775807n ? id : null;
};

// Legacy SQL timestamps have no offset. Treat them as UTC, consistently with
// the API's explicit-Z timestamps, rather than using the browser's time zone.
const utcTimestamp = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(value.trim());
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction, offset] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText || 0);
  const minute = Number(minuteText || 0);
  const second = Number(secondText || 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] ||
      hour > 23 || minute > 59 || second > 59) return null;

  const timestamp = `${yearText}-${monthText}-${dayText}T${hourText || '00'}:${minuteText || '00'}:${secondText || '00'}${fraction || ''}${offset || 'Z'}`;
  const milliseconds = Date.parse(timestamp);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : null;
};

const normalizeItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const notificationType = Object.hasOwn(notificationTypes, item.type) ? notificationTypes[item.type] : null;
  if (!notificationType) return null;

  const entityId = positiveEntityId(item.entityId);
  const id = stableId(item.id) ?? (entityId === null ? null : `${notificationType.apiType}:${entityId}`);
  const createdAt = utcTimestamp(item.createdAt ?? item.time);
  // A missing date cannot be placed in the list. Do not invent a recent alert
  // or count an unrenderable legacy record as unread.
  if (id === null || createdAt === null) return null;

  return {
    ...item,
    id,
    type: notificationType.type,
    createdAt,
    read: item.read === true || item.read === 1 || item.read === 'true' || item.read === '1',
    title: item.title || 'اعلان',
    message: item.message || ''
  };
};

export const normalizeDashboardNotifications = (payload) => {
  const source = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data) ? payload.data : [];
  const seenIds = new Set();
  const items = source.map(normalizeItem).filter((item) => {
    if (!item || seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  // This count covers the server's complete feed, even when only ten items are
  // fetched. Derive it locally only for responses without valid metadata.
  const unreadCount = Number.isInteger(payload?.unreadCount) && payload.unreadCount >= 0
    ? payload.unreadCount
    : items.filter((item) => !item.read).length;
  return { items, unreadCount };
};

const formatTehranJalaliDate = (milliseconds) => {
  const parts = Object.fromEntries(tehranJalaliFormatter.formatToParts(milliseconds)
    .filter(({ type }) => ['year', 'month', 'day'].includes(type))
    .map(({ type, value }) => [type, value]));
  return `${parts.day} ${parts.month} ${parts.year}`;
};

export const buildNotificationGroups = (items, { now = Date.now() } = {}) => {
  const nowMilliseconds = new Date(now).getTime();
  if (!Number.isFinite(nowMilliseconds)) return [];
  const groups = new Map();
  const olderDateTimestamps = new Map();

  for (const item of normalizeDashboardNotifications(items).items) {
    if (item.read) continue;
    const milliseconds = Date.parse(item.createdAt);
    // Keep at-now and future timestamps visible without changing the actual
    // event time. The inclusive boundaries cover exactly 12, 24 and 48 hours.
    const age = Math.max(0, nowMilliseconds - milliseconds);
    let period;
    let timeText;
    if (age <= 12 * HOUR_MS) {
      period = 'last12Hours';
      timeText = '12 ساعت گذشته';
    } else if (age <= 24 * HOUR_MS) {
      period = '12to24Hours';
      timeText = 'دیروز';
    } else if (age <= 48 * HOUR_MS) {
      period = '24to48Hours';
      timeText = 'پریروز';
    } else {
      period = 'older';
      timeText = formatTehranJalaliDate(milliseconds);
      if (!olderDateTimestamps.has(timeText)) olderDateTimestamps.set(timeText, milliseconds);
    }

    const key = `${period}:${timeText}:${item.type}`;
    if (!groups.has(key)) {
      groups.set(key, {
        type: item.type,
        count: 0,
        unreadCount: 0,
        timeText,
        period,
        ids: []
      });
    }
    const group = groups.get(key);
    group.count += 1;
    group.unreadCount += 1;
    group.ids.push(item.id);
  }

  return [...groups.values()].sort((a, b) => {
    const periodOrder = PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period);
    if (periodOrder) return periodOrder;
    const dateOrder = a.period === 'older'
      ? olderDateTimestamps.get(b.timeText) - olderDateTimestamps.get(a.timeText)
      : 0;
    // Preserve the existing visual type order within each period or older day;
    // only the date groups and their member IDs use timestamp order.
    return dateOrder || TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
  });
};
