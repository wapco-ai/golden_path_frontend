const dateTimeFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

// A birthday is a calendar date, not an instant. UTC formatting preserves the
// recorded day regardless of the administrator's browser time zone.
const birthDateFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const isGregorianDate = (year, month, day) => {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
};

const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;

const count = (value) => {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
};

export const formatRecentUserBirthDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value) || '');
  if (!match || !isGregorianDate(Number(match[1]), Number(match[2]), Number(match[3]))) return null;
  return birthDateFormatter.format(new Date(`${match[0]}T00:00:00Z`));
};

export const formatRecentUserDateTime = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/i.exec(text(value) || '');
  if (!match) return null;
  const [, year, month, day, hour = '00', minute = '00', second = '00', fraction = '', offset = 'Z'] = match;
  if (!isGregorianDate(Number(year), Number(month), Number(day)) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;

  // Older dashboard responses contained naive SQL timestamps in UTC. Never
  // interpret these as local browser time or replace absent dates with today.
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${offset}`);
  return Number.isNaN(date.getTime()) ? null : dateTimeFormatter.format(date);
};

const genderLabels = { male: 'مرد', female: 'زن', other: 'سایر' };

export const normalizeRecentUser = (raw, index = 0) => {
  const user = raw && typeof raw === 'object' ? raw : {};
  const gender = text(user.gender);
  return {
    id: user.id ?? index,
    fullName: text(user.name) || text(user.fullName) || text(user.email) || '---',
    phone: text(user.mobile) || text(user.phone) || '-',
    registerDate: formatRecentUserDateTime(user.joinDate),
    gender: gender && Object.hasOwn(genderLabels, gender) ? genderLabels[gender] : gender || '-',
    successCount: count(user.successCount),
    birthDate: formatRecentUserBirthDate(user.birthDate),
    email: text(user.email),
    province: text(user.province),
    city: text(user.city),
    lastLogin: formatRecentUserDateTime(user.lastLoginAt),
    savedRoutesCount: count(user.savedRoutesCount),
    placeVisitsCount: count(user.placeVisitsCount)
  };
};
