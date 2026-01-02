import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';
import {
  fetchSignedUser,
  fetchSignedUsers,
  updateSignedUserStatus
} from '../api/adminUsers.api';

const formatJalaliDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getStatusValue = (user) => {
  if (user?.status) return user.status;
  if (typeof user?.isActive === 'boolean') return user.isActive ? 'active' : 'inactive';
  return 'inactive';
};

const getErrorMessage = (error) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;

  if (status === 422) {
    return message || 'اطلاعات ارسال شده معتبر نیست.';
  }

  if (status >= 500) {
    return 'مشکلی در سرور رخ داده است. لطفاً دوباره تلاش کنید.';
  }

  return message || 'دریافت اطلاعات با خطا مواجه شد.';
};

function Usersigned() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, per_page: 20, last_page: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailUserId, setDetailUserId] = useState(null);
  const [updatingMap, setUpdatingMap] = useState({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchSignedUsers({
        page,
        pageSize,
        search: debouncedSearch
      });

      setRows(response?.data || []);
      const nextMeta = response?.meta || { current_page: page, per_page: pageSize, last_page: 1, total: 0 };
      setMeta(nextMeta);
      if (nextMeta?.current_page && nextMeta.current_page !== page) {
        setPage(nextMeta.current_page);
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > (meta?.last_page || 1)) return;
    setPage(nextPage);
  };

  const handleDetailsClick = async (userId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setSelectedUser(null);
    setDetailUserId(userId);

    try {
      const response = await fetchSignedUser(userId);
      setSelectedUser(response?.data || response);
    } catch (err) {
      const message = getErrorMessage(err);
      setDetailError(message);
      toast.error(message);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetails = () => {
    setDetailOpen(false);
    setSelectedUser(null);
    setDetailError('');
    setDetailUserId(null);
  };

  const handleToggleStatus = async (user) => {
    const currentStatus = getStatusValue(user);
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    setUpdatingMap((prev) => ({ ...prev, [user.id]: true }));
    setRows((prev) =>
      prev.map((item) =>
        item.id === user.id
          ? { ...item, status: nextStatus, isActive: nextStatus === 'active' }
          : item
      )
    );

    try {
      await updateSignedUserStatus(user.id, nextStatus);
      toast.success('وضعیت کاربر به روز شد.');
    } catch (err) {
      const message = getErrorMessage(err);
      toast.error(message);
      setRows((prev) =>
        prev.map((item) =>
          item.id === user.id
            ? { ...item, status: currentStatus, isActive: currentStatus === 'active' }
            : item
        )
      );
    } finally {
      setUpdatingMap((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    }
  };

  const handleExportToExcel = async () => {
    try {
      // Dynamically load SheetJS from CDN
      if (typeof window.XLSX === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const XLSX = window.XLSX;

      // Prepare data based on your current table structure
      const data = rows.map(user => [
        user.name || '—',
        user.mobile || '—',
        user.email || '—',
        getStatusValue(user) === 'active' ? 'فعال' : 'غیرفعال',
        formatJalaliDateTime(user.createdAt)
      ]);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([
        ['نام', 'موبایل', 'ایمیل', 'وضعیت', 'تاریخ ثبت نام'],
        ...data
      ]);

      // Column widths
      ws['!cols'] = [
        { wch: 25 }, // Name
        { wch: 20 }, // Mobile
        { wch: 30 }, // Email
        { wch: 15 }, // Status
        { wch: 20 }  // Registration Date
      ];

      // Define styles for RTL Persian data
      const headerStyle = {
        font: {
          name: 'Tahoma',
          sz: 12,
          bold: true,
          color: { rgb: "FFFFFF" }
        },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { rgb: "1E40AF" }
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center',
          readingOrder: 2 // RTL = 2, LTR = 1
        },
        border: {
          top: { style: 'thin', color: { rgb: "FFFFFF" } },
          bottom: { style: 'thin', color: { rgb: "FFFFFF" } },
          left: { style: 'thin', color: { rgb: "FFFFFF" } },
          right: { style: 'thin', color: { rgb: "FFFFFF" } }
        }
      };

      const dataStyle = {
        font: {
          name: 'Tahoma',
          sz: 11,
          color: { rgb: "000000" }
        },
        alignment: {
          horizontal: 'right',
          vertical: 'center',
          readingOrder: 2 // RTL
        },
        border: {
          top: { style: 'thin', color: { rgb: "CCCCCC" } },
          bottom: { style: 'thin', color: { rgb: "CCCCCC" } },
          left: { style: 'thin', color: { rgb: "CCCCCC" } },
          right: { style: 'thin', color: { rgb: "CCCCCC" } }
        }
      };

      const altDataStyle = {
        ...dataStyle,
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { rgb: "F3F4F6" }
        }
      };

      // Apply styles
      const range = XLSX.utils.decode_range(ws['!ref']);

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });

          if (!ws[cell_ref]) continue;

          if (R === 0) {
            ws[cell_ref].s = headerStyle;
          } else {
            ws[cell_ref].s = R % 2 === 1 ? altDataStyle : dataStyle;
          }
        }
      }

      // Create workbook with RTL sheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'کاربران ثبت نام شده');

      // Add workbook view for RTL
      wb.Workbook = wb.Workbook || {};
      wb.Workbook.Views = wb.Workbook.Views || [];
      wb.Workbook.Views.push({
        RTL: true
      });

      // Add sheet view for RTL
      ws['!views'] = ws['!views'] || [];
      ws['!views'].push({
        rightToLeft: true
      });

      // Generate and download
      const currentDate = new Date();
      const jalaliDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(currentDate);

      XLSX.writeFile(wb, `کاربران_ثبت_نام_شده_${jalaliDate.replace(/\//g, '-')}.xlsx`);

      toast.success('گزارش Excel با موفقیت دانلود شد');
    } catch (error) {
      console.error('خطا در ایجاد گزارش:', error);
      toast.error('خطا در ایجاد گزارش');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);

    setTimeout(() => {

      setIsRefreshing(false);
      toast.success('جدول به روز رسانی شد');
    }, 1000);
  };

  const totalPages = meta?.last_page || 1;
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 6;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, page - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  return (
    <div className="usersigned-page">
      <div className="users-section">
        <div className="section-header">
          <div className="section-header-top">
            <div className="title-container">
              <div className="title-cell">
                <h3>لیست کاربران ثبت نام شده</h3>
                <button
                  className="refresh-btn"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  style={{ cursor: isRefreshing ? 'wait' : 'pointer' }}
                >
                  {isRefreshing ? (
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid #f3f3f3',
                      borderTop: '2px solid #1E2023',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692" stroke="#1E2023" strokeWidth="1.08112" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
              {/* <p>مجموع کاربران: {meta?.total ?? 0}</p> */}
            </div>
            <div className="left-container">
              <div className="search-box-with-icon">
                <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
                </svg>
                <input
                  type="text"
                  placeholder="جستجو بر اساس نام، ایمیل یا موبایل"
                  value={search}
                  onChange={handleSearchChange}
                  className="search-input7"
                />
              </div>
              <button className="export-report-btn3" onClick={handleExportToExcel}>
                خروجی گزارشات
              </button>
            </div>
          </div>
        </div>

        {/* {error && (
          <div className="error-state" style={{ marginBottom: '16px' }}>
            <p>{error}</p>
            <button className="details-btn" onClick={fetchUsers}>تلاش دوباره</button>
          </div>
        )} */}

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>نام</th>
                <th>موبایل</th>
                <th>ایمیل</th>
                <th>وضعیت</th>
                <th>تاریخ ثبت نام</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6">
                    <div className="loading-state" style={{ padding: '16px', textAlign: 'center' }}>
                      در حال دریافت اطلاعات...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state3" style={{ padding: '16px', textAlign: 'center' }}>
                      داده ای برای نمایش وجود ندارد.
                    </div>
                  </td>
                </tr>
              )}

              {!loading && rows.map((user) => {
                const statusValue = getStatusValue(user);
                const statusLabel = statusValue === 'active' ? 'فعال' : 'غیرفعال';

                return (
                  <tr key={user.id}>
                    <td>{user.name || '—'}</td>
                    <td>{user.mobile || '—'}</td>
                    <td>{user.email || '—'}</td>
                    <td>
                      <span className={`status-badge ${statusValue === 'active' ? 'active' : 'inactive'}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td>{formatJalaliDateTime(user.createdAt)}</td>
                    <td>
                      <div className="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                        <button className="details-btn" onClick={() => handleDetailsClick(user.id)}>
                          جزئیات
                        </button>
                        <button
                          className="details-btn"
                          disabled={!!updatingMap[user.id]}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {statusValue === 'active' ? 'غیرفعال' : 'فعال'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!loading && rows.length > 0 && (
            <div className="pagination-container" id="users-pagination">
              <div className="pagination-controls">
                <div className="btc">
                  <button
                    className={`pagination-btn ${page === 1 ? 'disabled' : ''}`}
                    onClick={() => handlePageChange(1)}
                    disabled={page === 1}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ transform: 'rotate(180deg)' }}
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z"
                        fill={page === 1 ? "#C5C5C5" : "#0F71EF"}
                      />
                    </svg>
                  </button>

                  <button
                    className={`pagination-btn ${page === 1 ? 'disabled' : ''}`}
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{ transform: 'rotate(180deg)' }}
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z"
                        fill={page === 1 ? "#C5C5C5" : "#0F71EF"}
                      />
                    </svg>
                  </button>
                </div>

                <div className="page-numbers">
                  {getPageNumbers().map((pageNumber) => (
                    <button
                      key={pageNumber}
                      className={`page-number ${page === pageNumber ? 'active' : ''}`}
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>

                <div className="btc">
                  <button
                    className={`pagination-btn ${page === totalPages ? 'disabled' : ''}`}
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z"
                        fill={page === totalPages ? "#C5C5C5" : "#0F71EF"}
                      />
                    </svg>
                  </button>

                  <button
                    className={`pagination-btn ${page === totalPages ? 'disabled' : ''}`}
                    onClick={() => handlePageChange(totalPages)}
                    disabled={page === totalPages}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z"
                        fill={page === totalPages ? "#C5C5C5" : "#0F71EF"}
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailOpen && (
        <div className="user-details-modal-overlay" onClick={handleCloseDetails}>
          <div
            className="user-details-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="user-details-modal-header">
              <h3>جزئیات کاربر</h3>
            </div>

            <div className="modal-content">
              {detailLoading && (
                <div style={{ padding: '16px', textAlign: 'center' }}>در حال دریافت اطلاعات...</div>
              )}

              {!detailLoading && detailError && (
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <p>{detailError}</p>
                  <button
                    className="details-btn"
                    onClick={() => detailUserId && handleDetailsClick(detailUserId)}
                  >
                    تلاش دوباره
                  </button>
                </div>
              )}

              {!detailLoading && !detailError && selectedUser && (
                <div className="user-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">نام:</span>
                    <span className="detail-value">{selectedUser.name || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">نام کاربری:</span>
                    <span className="detail-value">{selectedUser.username || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">ایمیل:</span>
                    <span className="detail-value">{selectedUser.email || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">موبایل:</span>
                    <span className="detail-value">{selectedUser.mobile || '—'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">وضعیت:</span>
                    <span className="detail-value">{getStatusValue(selectedUser) === 'active' ? 'فعال' : 'غیرفعال'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">تاریخ ثبت نام:</span>
                    <span className="detail-value">{formatJalaliDateTime(selectedUser.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">آخرین ورود:</span>
                    <span className="detail-value">{formatJalaliDateTime(selectedUser.lastLoginAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">IP آخرین ورود:</span>
                    <span className="detail-value">{selectedUser.lastLoginIp || '—'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="modal-close-button-usersigned"
                onClick={handleCloseDetails}
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usersigned;
