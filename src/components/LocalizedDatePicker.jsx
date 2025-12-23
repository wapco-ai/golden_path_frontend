import React, { useMemo } from 'react';
import DatePicker from 'react-multi-date-picker';
import DateObject from 'react-date-object';
import 'react-multi-date-picker/styles/layouts/mobile.css';
import gregorian from 'react-date-object/calendars/gregorian';
import persian from 'react-date-object/calendars/persian';
import arabic from 'react-date-object/calendars/arabic';
import gregorian_en from 'react-date-object/locales/gregorian_en';
import persian_fa from 'react-date-object/locales/persian_fa';
import arabic_ar from 'react-date-object/locales/arabic';
import urdu from 'react-date-object/locales/urdu';

const CALENDAR_BY_LANG = {
  fa: { calendar: persian, locale: persian_fa, direction: 'rtl' },
  en: { calendar: gregorian, locale: gregorian_en, direction: 'ltr' },
  ar: { calendar: arabic, locale: arabic_ar, direction: 'rtl' },
  ur: { calendar: arabic, locale: urdu, direction: 'rtl' }
};

const FORMAT_STRING = 'YYYY-MM-DD';

const isoToDateObject = (value, calendar, locale) => {
  if (!value) return null;
  const jsDate = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(jsDate.getTime())) return null;

  return new DateObject({
    date: jsDate,
    calendar: gregorian,
    locale: gregorian_en
  }).convert(calendar, locale);
};

const dateObjectToIso = (dateObject) => {
  if (!dateObject) return '';
  try {
    return dateObject.convert(gregorian, gregorian_en).format(FORMAT_STRING);
  } catch (error) {
    return '';
  }
};

function LocalizedDatePicker({
  value,
  onChange,
  lang = 'en',
  minDate,
  maxDate,
  disabled = false,
  error,
  helperText,
  inputClassName = 'form-input'
}) {
  const { calendar, locale, direction } = CALENDAR_BY_LANG[lang] || CALENDAR_BY_LANG.en;

  const pickerValue = useMemo(
    () => isoToDateObject(value, calendar, locale),
    [value, calendar, locale]
  );

  const pickerMinDate = useMemo(
    () => isoToDateObject(minDate, calendar, locale),
    [minDate, calendar, locale]
  );

  const pickerMaxDate = useMemo(
    () => isoToDateObject(maxDate, calendar, locale),
    [maxDate, calendar, locale]
  );

  const handleChange = (date) => {
    const normalized = Array.isArray(date) ? date[0] : date;
    const isoValue = dateObjectToIso(normalized);
    onChange?.(isoValue);
  };

  const isRtl = direction === 'rtl';

  return (
    <div className={`localized-date-picker ${isRtl ? 'rtl' : 'ltr'}`} dir={direction}>
      <DatePicker
        value={pickerValue}
        onChange={handleChange}
        calendar={calendar}
        locale={locale}
        minDate={pickerMinDate}
        maxDate={pickerMaxDate}
        render={<input className={`${inputClassName} ${error ? 'error' : ''}`} />}
        format={FORMAT_STRING}
        editable
        disabled={disabled}
        calendarPosition="bottom-center"
      />
      {helperText && (
        <div className={`helper-text ${error ? 'error' : ''}`}>
          {helperText}
        </div>
      )}
    </div>
  );
}

export default LocalizedDatePicker;
