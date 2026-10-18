import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIN_JALALI_YEAR,
  MAX_JALALI_YEAR,
  normalizeDateDigits,
  parseJalaliInput,
  formatJalaliInput,
  jalaliToGregorianDay,
  compareJalaliDates,
  validateJalaliRange,
  currentTehranJalali,
  jalaliMonthLength,
  jalaliMonthStart
} from '../src/utils/signedUserDates.js';

test('normalizes Persian, Arabic and mixed digits without changing separators', () => {
  assert.equal(normalizeDateDigits('۱۴۰۳/١٢/۳۰'), '1403/12/30');
  assert.equal(normalizeDateDigits('۰۱۲۳۴۵۶۷۸۹ ٠١٢٣٤٥٦٧٨٩'), '0123456789 0123456789');
  assert.equal(normalizeDateDigits(null), '');
  assert.equal(normalizeDateDigits(undefined), '');
});

test('parses real Persian dates and formats padded values', () => {
  const expected = { year: 1403, month: 1, day: 9 };
  assert.deepEqual(parseJalaliInput(' ۱۴۰۳/۱/٩ '), expected);
  assert.equal(formatJalaliInput(expected), '1403/01/09');
  assert.deepEqual(parseJalaliInput('1300/01/01'), { year: 1300, month: 1, day: 1 });
  assert.equal(formatJalaliInput({ year: 1, month: 1, day: 1 }), '0001/01/01');
});

test('rejects malformed input and dates outside the supported calendar', () => {
  for (const input of ['', ' ', '1403-01-01', '1403/01/01 extra', '1403/1',
    '1403/01/01/02', '1403.5/01/01', '1403/00/01', '1403/13/01',
    '1403/01/00', '1403/01/32', '1403/07/31', '0000/01/01',
    '-1/01/01', '3178/01/01', null, undefined]) {
    assert.equal(parseJalaliInput(input), null, String(input));
  }
  assert.equal(MIN_JALALI_YEAR, 1);
  assert.equal(MAX_JALALI_YEAR, 3177);
  assert.deepEqual(parseJalaliInput('3177/01/01'), { year: 3177, month: 1, day: 1 });
});

test('observes Esfand leap days rather than accepting every day 30', () => {
  assert.deepEqual(parseJalaliInput('۱۴۰۳/۱۲/۳۰'), { year: 1403, month: 12, day: 30 });
  assert.equal(parseJalaliInput('۱۴۰۴/۱۲/۳۰'), null);
  assert.equal(jalaliMonthLength(1403, 12), 30);
  assert.equal(jalaliMonthLength(1404, 12), 29);
  assert.equal(jalaliMonthLength(1404, 6), 31);
  assert.equal(jalaliMonthLength(1404, 7), 30);
});

test('converts dates to Gregorian date-only values across Nowruz and older years', () => {
  assert.equal(jalaliToGregorianDay({ year: 1403, month: 12, day: 30 }), '2025-03-20');
  assert.equal(jalaliToGregorianDay({ year: 1404, month: 1, day: 1 }), '2025-03-21');
  assert.equal(jalaliToGregorianDay({ year: 1300, month: 1, day: 1 }), '1921-03-21');
  assert.equal(jalaliToGregorianDay({ year: 1, month: 1, day: 1 }), '0622-03-22');
  assert.equal(jalaliToGregorianDay({ year: 1404, month: 12, day: 30 }), null);
});

test('compares calendar days correctly across leap-year and year boundaries', () => {
  const lastLeapDay = { year: 1403, month: 12, day: 30 };
  const newYear = { year: 1404, month: 1, day: 1 };
  assert.equal(compareJalaliDates(lastLeapDay, newYear), -1);
  assert.equal(compareJalaliDates(newYear, lastLeapDay), 1);
  assert.equal(compareJalaliDates(newYear, { ...newYear }), 0);
  assert.equal(compareJalaliDates({ year: 1300, month: 1, day: 1 }, newYear) < 0, true);
  assert.equal(Number.isNaN(compareJalaliDates(null, newYear)), true);
});

test('accepts optional range bounds and identical start/end days', () => {
  assert.deepEqual(validateJalaliRange('', ' '), { startDate: null, endDate: null, error: '' });
  assert.deepEqual(validateJalaliRange(undefined, '۱۴۰۴/۱/۱'), {
    startDate: null, endDate: { year: 1404, month: 1, day: 1 }, error: ''
  });
  assert.deepEqual(validateJalaliRange('1403/12/30', null), {
    startDate: { year: 1403, month: 12, day: 30 }, endDate: null, error: ''
  });
  assert.equal(validateJalaliRange('۱۴۰۴/۱/۱', '١٤٠٤/٠١/٠١').error, '');
  assert.equal(validateJalaliRange('1403/12/30', '1404/01/01').error, '');
});

test('rejects nonempty invalid range bounds and reversed ranges with Persian messages', () => {
  assert.match(validateJalaliRange('1404/12/30', '').error, /تاریخ شروع نامعتبر/);
  assert.match(validateJalaliRange('', 'abc').error, /تاریخ پایان نامعتبر/);
  assert.match(validateJalaliRange('1404/01/01', '1403/12/30').error, /شروع نباید بعد/);
  assert.equal(validateJalaliRange('1403/12/30', '1404/12/30').endDate, null);
});

test('uses the Tehran day before and after Tehran midnight, independently of UTC midnight', () => {
  assert.deepEqual(currentTehranJalali(new Date('2026-10-18T20:29:59.999Z')),
    { year: 1405, month: 7, day: 26 });
  assert.deepEqual(currentTehranJalali(Date.parse('2026-10-18T20:30:00.000Z')),
    { year: 1405, month: 7, day: 27 });
  assert.deepEqual(currentTehranJalali(new Date('2026-10-18T23:59:59.999Z')),
    { year: 1405, month: 7, day: 27 });
  assert.deepEqual(currentTehranJalali(new Date('2026-10-19T00:00:00.000Z')),
    { year: 1405, month: 7, day: 27 });
});

test('converts Tehran Nowruz midnight using the same leap-year calendar as validation', () => {
  assert.deepEqual(currentTehranJalali('2025-03-20T20:29:59Z'),
    { year: 1403, month: 12, day: 30 });
  assert.deepEqual(currentTehranJalali('2025-03-20T20:30:00Z'),
    { year: 1404, month: 1, day: 1 });
  assert.equal(currentTehranJalali(new Date('invalid')), null);
  assert.equal(currentTehranJalali('invalid'), null);
});

test('computes Saturday-first month offsets from Gregorian UTC weekdays', () => {
  // 1404/01/01 is Friday 2025-03-21; 1403/01/01 is Wednesday 2024-03-20.
  assert.equal(jalaliMonthStart(1404, 1), 6);
  assert.equal(jalaliMonthStart(1403, 1), 4);
  // 1403/10/01 is Saturday 2024-12-21.
  assert.equal(jalaliMonthStart(1403, 10), 0);
  // The older year remains available and starts on Monday 1921-03-21.
  assert.equal(jalaliMonthStart(1300, 1), 2);
});

test('invalid date objects and calendar coordinates fail without normalizing into another day', () => {
  for (const date of [null, {}, { year: 1404, month: 12, day: 30 },
    { year: 1404, month: 1, day: 1.5 }, { year: '1404', month: 1, day: 1 }]) {
    assert.equal(formatJalaliInput(date), '');
    assert.equal(jalaliToGregorianDay(date), null);
  }
  for (const [year, month] of [[0, 1], [3178, 1], [1404, 0], [1404, 13], [1404.5, 1], [1404, 1.5]]) {
    assert.equal(jalaliMonthLength(year, month), null);
    assert.equal(jalaliMonthStart(year, month), null);
  }
});
