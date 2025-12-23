const CALENDAR_LOCALES = {
  fa: 'fa-IR-u-ca-persian',
  en: 'en-US-u-ca-gregory',
  ar: 'ar-SA-u-ca-islamic-umalqura',
  ur: 'ur-PK-u-ca-islamic'
};

export const resolveCalendarLocale = (language) => CALENDAR_LOCALES[language] || CALENDAR_LOCALES.en;

export const resolveDirection = (language) => (language === 'en' ? 'ltr' : 'rtl');

export const createCalendarFormatter = (locale) => new Intl.DateTimeFormat(locale, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC'
});

export const createMonthLabelFormatter = (locale) => new Intl.DateTimeFormat(locale, {
  month: 'long',
  timeZone: 'UTC'
});

export const extractCalendarParts = (formatter, date) => {
  if (!formatter || !date) {
    return { year: '', month: '', day: '' };
  }

  const parts = formatter.formatToParts(date);
  const getPart = (type) => {
    const value = parts.find((part) => part.type === type)?.value;
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? '' : numberValue;
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day')
  };
};

export const findGregorianDateByCalendarParts = (formatter, year, month, day) => {
  if (!formatter || !year || !month || !day) {
    return null;
  }

  const matchesCalendarParts = (date) => {
    const parts = extractCalendarParts(formatter, date);
    return parts.year === year && parts.month === month && parts.day === day;
  };

  const referenceDate = new Date(Date.UTC(year, month - 1, day));
  if (matchesCalendarParts(referenceDate)) {
    return referenceDate;
  }

  const MAX_SEARCH_DAYS = 2000;
  for (let offset = 1; offset <= MAX_SEARCH_DAYS; offset += 1) {
    const forward = new Date(referenceDate);
    forward.setUTCDate(referenceDate.getUTCDate() + offset);
    if (matchesCalendarParts(forward)) {
      return forward;
    }

    const backward = new Date(referenceDate);
    backward.setUTCDate(referenceDate.getUTCDate() - offset);
    if (matchesCalendarParts(backward)) {
      return backward;
    }
  }

  return null;
};

export const daysInCalendarMonth = (formatter, year, month) => {
  if (!year || !month) {
    return [];
  }

  const firstDayOfMonth = findGregorianDateByCalendarParts(formatter, year, month, 1);
  if (!firstDayOfMonth) {
    return [];
  }

  const days = [];
  let probeDate = new Date(firstDayOfMonth);

  while (true) {
    const parts = extractCalendarParts(formatter, probeDate);
    if (parts.month !== month || parts.year !== year) {
      break;
    }
    days.push(parts.day);
    probeDate.setUTCDate(probeDate.getUTCDate() + 1);
    if (days.length > 370) {
      break;
    }
  }

  return days;
};

export const formatLocalizedNumber = (value, locale) => {
  if (!value && value !== 0) return '';
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch (err) {
    return value;
  }
};

export const parseISODateValue = (value) => {
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const normalizeBirthDateValue = (value) => {
  const parsed = parseISODateValue(value);
  return parsed ? parsed.toISOString() : '';
};

export default {
  resolveCalendarLocale,
  resolveDirection,
  createCalendarFormatter,
  createMonthLabelFormatter,
  extractCalendarParts,
  findGregorianDateByCalendarParts,
  daysInCalendarMonth,
  formatLocalizedNumber,
  parseISODateValue,
  normalizeBirthDateValue
};
