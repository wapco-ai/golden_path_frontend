import React, { Fragment, useEffect, useState } from 'react';
import { FiChevronDown, FiFilter, FiRefreshCw } from 'react-icons/fi';
import { fetchAdminActivityLogs } from '../services/adminActivityLogsService';
import './ActivityLogs.css';

const EMPTY_FILTERS = { from: '', to: '', actorId: '', entityId: '', operation: '', result: '' };
const OPERATIONS = {
  login: 'ورود',
  logout: 'خروج',
  refresh: 'تمدید نشست',
  read: 'خواندن',
  post: 'ارسال',
  update: 'ویرایش',
  delete: 'حذف',
  other: 'سایر',
};
const SECTIONS = {
  'cultural-items': 'اطلاعات فرهنگی',
  'admin/activity-logs': 'لاگ فعالیت کاربران',
  'admin/auth': 'نشست ادمین',
  auth: 'نشست کاربر',
  areas: 'محدوده‌ها',
  doors: 'درب‌ها',
  'admin/guidance-points': 'نقاط راهنما',
};
const tehranDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
});
const tehranTime = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const faNumber = new Intl.NumberFormat('fa-IR', { useGrouping: false });

function normalizeId(value) {
  const digits = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩';
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String(digits.indexOf(digit) % 10));
}

function getSection(route) {
  const path = route.replace(/^api\/v1\//, '');
  return Object.entries(SECTIONS).find(([prefix]) => path === prefix || path.startsWith(prefix + '/'))?.[1];
}

export default function ActivityLogs() {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState({ filters: EMPTY_FILTERS, cursors: [null] });
  const [data, setData] = useState({ items: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = Object.fromEntries(Object.entries(query.filters).filter(([, value]) => value !== ''));
    if (params.from) params.from += ':00+03:30';
    if (params.to) params.to += ':59+03:30';
    const cursor = query.cursors.at(-1);
    if (cursor) params.cursor = cursor;
    fetchAdminActivityLogs(params, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(failure.response?.status === 403
          ? 'حساب شما مجوز مشاهدهٔ لاگ فعالیت را ندارد.'
          : 'دریافت رویدادها ناموفق بود. دوباره تلاش کنید.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query]);

  const load = (filters, cursors = [null]) => {
    setLoading(true);
    setError('');
    setExpanded(null);
    setQuery({ filters, cursors });
  };
  const change = ({ target: { name, value } }) => {
    setDraft((previous) => ({
      ...previous,
      [name]: name === 'actorId' || name === 'entityId' ? normalizeId(value) : value,
    }));
  };

  return (
    <section className="activity-logs" dir="rtl" aria-label="لاگ فعالیت کاربران">
      <form className="activity-filters" onSubmit={(event) => {
        event.preventDefault();
        load(draft);
      }}>
        <div className="activity-filters-grid">
          <label>از تاریخ و ساعت
            <input name="from" type="datetime-local" dir="ltr" value={draft.from} max={draft.to || undefined} onChange={change} />
          </label>
          <label>تا تاریخ و ساعت
            <input name="to" type="datetime-local" dir="ltr" value={draft.to} min={draft.from || undefined} onChange={change} />
          </label>
          <label>شناسهٔ حساب
            <input name="actorId" inputMode="numeric" pattern="[0-9]{1,19}" maxLength={19} dir="ltr" value={draft.actorId} onChange={change} />
          </label>
          <label>شناسهٔ رکورد
            <input name="entityId" inputMode="numeric" pattern="[0-9]{1,19}" maxLength={19} dir="ltr" value={draft.entityId} onChange={change} />
          </label>
          <label>عملیات
            <select name="operation" value={draft.operation} onChange={change}>
              <option value="">همهٔ عملیات</option>
              {Object.entries(OPERATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>نتیجه
            <select name="result" value={draft.result} onChange={change}>
              <option value="">همهٔ نتایج</option>
              <option value="success">موفق</option>
              <option value="failure">ناموفق</option>
            </select>
          </label>
        </div>
        <div className="activity-filter-footer">
          <span>تاریخ ورودی میلادی و زمان‌ها به وقت تهران است.</span>
          <div className="activity-actions">
            <button type="button" onClick={() => {
              setDraft(EMPTY_FILTERS);
              load(EMPTY_FILTERS);
            }}>پاک کردن فیلترها</button>
            <button type="submit" className="activity-primary"><FiFilter aria-hidden="true" /> اعمال فیلتر</button>
          </div>
        </div>
      </form>

      <div className="activity-results" aria-busy={loading}>
        <div className="activity-results-header">
          <span role="status">{loading ? 'در حال دریافت رویدادها…' : error ? 'رویدادها' : `${faNumber.format(data.items.length)} رویداد در این صفحه`}</span>
          <button type="button" disabled={loading} onClick={() => load(query.filters)}>
            <FiRefreshCw aria-hidden="true" /> تازه‌سازی
          </button>
        </div>
        {error && <p className="activity-empty" role="alert">{error}</p>}
        {!loading && !error && data.items.length === 0 && (
          <p className="activity-empty">رویدادی مطابق فیلترهای انتخاب‌شده پیدا نشد.</p>
        )}
        {!loading && !error && data.items.length > 0 && (
          <div className="activity-table-scroll" tabIndex={0} role="region" aria-label="جدول رویدادها">
            <table className="activity-table">
              <thead>
                <tr>
                  <th scope="col">زمان</th><th scope="col">حساب</th><th scope="col">عملیات</th>
                  <th scope="col">بخش / رکورد</th><th scope="col">نتیجه</th><th scope="col">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const open = expanded === row.requestId;
                  const date = new Date(row.time);
                  const section = getSection(row.route);
                  const actorType = row.actorType === 'admin' ? 'ادمین' : 'کاربر';
                  const resultLabel = { success: 'موفق', failure: 'ناموفق', other: 'سایر' }[row.result];
                  return (
                    <Fragment key={row.requestId}>
                      <tr>
                        <td className="activity-time">
                          <time dateTime={row.time}>
                            <strong>{tehranTime.format(date)}</strong>
                            <small>{tehranDate.format(date)}</small>
                          </time>
                        </td>
                        <td>
                          <strong>{row.actorName || (row.actorId ? `حساب ${faNumber.format(row.actorId)}` : 'ناشناس')}</strong>
                          {row.actorId && <small>{actorType} · شناسه {faNumber.format(row.actorId)}</small>}
                        </td>
                        <td>{OPERATIONS[row.operation]}</td>
                        <td>
                          {section || <bdi dir="ltr" className="activity-code">/{row.route}</bdi>}
                          {row.entityId !== null && <small>رکورد <bdi>{row.entityId}</bdi></small>}
                        </td>
                        <td>
                          <span className={`activity-result activity-result-${row.result}`}>{resultLabel} <bdi>{row.status}</bdi></span>
                        </td>
                        <td>
                          <button className="activity-expand" type="button" aria-label={`جزئیات رویداد ${row.requestId}`}
                            aria-expanded={open} aria-controls={open ? `activity-${row.requestId}` : undefined}
                            onClick={() => setExpanded(open ? null : row.requestId)}>
                            <FiChevronDown aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr id={`activity-${row.requestId}`} className="activity-detail">
                          <td colSpan={6}>
                            <dl>
                              <div><dt>درخواست API</dt><dd><bdi dir="ltr" className="activity-code">{row.method} /{row.route}</bdi></dd></div>
                              <div><dt>شناسهٔ پیگیری</dt><dd><bdi dir="ltr" className="activity-code">{row.requestId}</bdi></dd></div>
                              {row.deletedRows !== null && <div><dt>تعداد رکوردهای حذف‌شده</dt><dd>{faNumber.format(row.deletedRows)}</dd></div>}
                              {row.logoutTokenMatched === false && <div><dt>نتیجهٔ خروج</dt><dd>نشست پیدا نشد.</dd></div>}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && (query.cursors.length > 1 || data.nextCursor) && (
          <nav className="activity-pages" aria-label="صفحه‌بندی رویدادها">
            <button type="button" disabled={query.cursors.length === 1}
              onClick={() => load(query.filters, query.cursors.slice(0, -1))}>جدیدتر</button>
            <span>صفحهٔ {faNumber.format(query.cursors.length)}</span>
            <button type="button" disabled={!data.nextCursor}
              onClick={() => load(query.filters, [...query.cursors, data.nextCursor])}>قدیمی‌تر</button>
          </nav>
        )}
      </div>
    </section>
  );
}
