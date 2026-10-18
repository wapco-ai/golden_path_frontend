import jalaali from 'jalaali-js';

export const MIN_JALALI_YEAR = 1;
export const MAX_JALALI_YEAR = 3177;

const tehranDayFormatter = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const pad = (value, length = 2) => String(value).padStart(length, '0');

const isValidYearMonth = (year, month) => (
  Number.isInteger(year) && year >= MIN_JALALI_YEAR && year <= MAX_JALALI_YEAR &&
  Number.isInteger(month) && month >= 1 && month <= 12
);

const isValidDate = (date) => Boolean(
  date && isValidYearMonth(date.year, date.month) && Number.isInteger(date.day) &&
  jalaali.isValidJalaaliDate(date.year, date.month, date.day)
);

export const normalizeDateDigits = (input) => String(input ?? '')
  .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
  .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));

export const parseJalaliInput = (input) => {
  const match = /^(\d{1,4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalizeDateDigits(input).trim());
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isValidDate(date) ? date : null;
};

export const formatJalaliInput = (date) => isValidDate(date)
  ? `${pad(date.year, 4)}/${pad(date.month)}/${pad(date.day)}`
  : '';

export const jalaliToGregorianDay = (date) => {
  if (!isValidDate(date)) return null;
  const { gy, gm, gd } = jalaali.toGregorian(date.year, date.month, date.day);
  return `${pad(gy, 4)}-${pad(gm)}-${pad(gd)}`;
};

// Compare whole calendar days without involving the browser's local time zone.
export const compareJalaliDates = (a, b) => {
  if (!isValidDate(a) || !isValidDate(b)) return Number.NaN;
  return jalaali.j2d(a.year, a.month, a.day) - jalaali.j2d(b.year, b.month, b.day);
};

export const validateJalaliRange = (startInput, endInput) => {
  const startText = normalizeDateDigits(startInput).trim();
  const endText = normalizeDateDigits(endInput).trim();
  const startDate = startText ? parseJalaliInput(startText) : null;
  const endDate = endText ? parseJalaliInput(endText) : null;
  let error = '';
  if (startText && !startDate) {
    error = 'تاریخ شروع نامعتبر است؛ تاریخ شمسی را به صورت سال/ماه/روز وارد کنید.';
  } else if (endText && !endDate) {
    error = 'تاریخ پایان نامعتبر است؛ تاریخ شمسی را به صورت سال/ماه/روز وارد کنید.';
  } else if (startDate && endDate && compareJalaliDates(startDate, endDate) > 0) {
    error = 'تاریخ شروع نباید بعد از تاریخ پایان باشد.';
  }
  return { startDate, endDate, error };
};

export const currentTehranJalali = (nowDate = Date.now()) => {
  const instant = new Date(nowDate);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = Object.fromEntries(tehranDayFormatter.formatToParts(instant)
    .filter(({ type }) => ['year', 'month', 'day'].includes(type))
    .map(({ type, value }) => [type, Number(value)]));
  try {
    const { jy, jm, jd } = jalaali.toJalaali(parts.year, parts.month, parts.day);
    const date = { year: jy, month: jm, day: jd };
    return isValidDate(date) ? date : null;
  } catch {
    return null;
  }
};

export const jalaliMonthLength = (year, month) => isValidYearMonth(year, month)
  ? jalaali.jalaaliMonthLength(year, month)
  : null;

// The Persian calendar grid starts on Saturday (0), followed by Sunday (1).
export const jalaliMonthStart = (year, month) => {
  if (!isValidYearMonth(year, month)) return null;
  const { gy, gm, gd } = jalaali.toGregorian(year, month, 1);
  return (new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay() + 1) % 7;
};
