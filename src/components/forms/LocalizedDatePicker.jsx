import React, { useEffect, useMemo, useState } from 'react';
import {
  createCalendarFormatter,
  createMonthLabelFormatter,
  daysInCalendarMonth,
  extractCalendarParts,
  findGregorianDateByCalendarParts,
  formatLocalizedNumber,
  normalizeBirthDateValue,
  parseISODateValue,
  resolveCalendarLocale,
  resolveDirection
} from '../../utils/calendarAdapters';
import '../../styles/LocalizedDatePicker.css';

const MAX_YEARS_BACK = 120;

const LocalizedDatePicker = ({
  language = 'en',
  value,
  onChange,
  labels = {},
  required = false
}) => {
  const calendarLocale = resolveCalendarLocale(language);
  const dir = resolveDirection(language);
  const calendarFormatter = useMemo(
    () => createCalendarFormatter(calendarLocale),
    [calendarLocale]
  );
  const monthLabelFormatter = useMemo(
    () => createMonthLabelFormatter(calendarLocale),
    [calendarLocale]
  );

  const [parts, setParts] = useState({ year: '', month: '', day: '' });

  useEffect(() => {
    const parsedDate = parseISODateValue(value);
    if (parsedDate) {
      setParts(extractCalendarParts(calendarFormatter, parsedDate));
    } else {
      setParts({ year: '', month: '', day: '' });
    }
  }, [value, calendarFormatter]);

  const currentCalendarYear = useMemo(
    () => extractCalendarParts(calendarFormatter, new Date()).year || new Date().getUTCFullYear(),
    [calendarFormatter]
  );

  const yearOptions = useMemo(() => {
    const years = [];
    for (let year = currentCalendarYear; year >= currentCalendarYear - MAX_YEARS_BACK; year -= 1) {
      years.push(year);
    }
    return years;
  }, [currentCalendarYear]);

  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      const sampleDate = findGregorianDateByCalendarParts(
        calendarFormatter,
        parts.year || currentCalendarYear,
        monthNumber,
        1
      ) || new Date(Date.UTC(currentCalendarYear, index, 1));

      return { value: monthNumber, label: monthLabelFormatter.format(sampleDate) };
    });
  }, [calendarFormatter, monthLabelFormatter, currentCalendarYear, parts.year]);

  const dayOptions = useMemo(
    () => daysInCalendarMonth(calendarFormatter, parts.year, parts.month),
    [calendarFormatter, parts.month, parts.year]
  );

  const handlePartChange = (field, rawValue) => {
    const nextParts = { ...parts, [field]: rawValue ? Number(rawValue) : '' };
    setParts(nextParts);

    if (nextParts.year && nextParts.month && nextParts.day) {
      const gregorianDate = findGregorianDateByCalendarParts(
        calendarFormatter,
        nextParts.year,
        nextParts.month,
        nextParts.day
      );
      if (gregorianDate) {
        const isoValue = normalizeBirthDateValue(gregorianDate.toISOString());
        onChange?.(isoValue);
        return;
      }
    }

    onChange?.('');
  };

  const { year: yearLabel, month: monthLabel, day: dayLabel } = labels;
  const containerClass = `localized-date-picker ${dir === 'rtl' ? 'rtl' : 'ltr'} input-container ${value ? 'filled' : ''}`;

  return (
    <div className={containerClass} dir={dir}>
      <div className="localized-date-picker__inputs birthdate-container">
        <select
          className="form-input birthdate-select"
          value={parts.year}
          onChange={(e) => handlePartChange('year', e.target.value)}
          aria-label={yearLabel}
        >
          <option value="">{yearLabel || 'Year'}</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>{formatLocalizedNumber(year, calendarLocale)}</option>
          ))}
        </select>
        <select
          className="form-input birthdate-select"
          value={parts.month}
          onChange={(e) => handlePartChange('month', e.target.value)}
          aria-label={monthLabel}
        >
          <option value="">{monthLabel || 'Month'}</option>
          {monthOptions.map((month) => (
            <option key={month.value} value={month.value}>{month.label}</option>
          ))}
        </select>
        <select
          className="form-input birthdate-select"
          value={parts.day}
          onChange={(e) => handlePartChange('day', e.target.value)}
          aria-label={dayLabel}
        >
          <option value="">{dayLabel || 'Day'}</option>
          {dayOptions.map((day) => (
            <option key={day} value={day}>{formatLocalizedNumber(day, calendarLocale)}</option>
          ))}
        </select>
      </div>
      {required && <span className="localized-date-picker__required" aria-hidden="true">*</span>}
    </div>
  );
};

export default LocalizedDatePicker;
