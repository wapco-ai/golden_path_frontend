// src/pages/Userlogs.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';
import { exportAdminUserLogs, fetchAdminUserLogs } from '../services/adminUserLogsService';

function Userlogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userLogs, setUserLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 6,
    total: 0,
    pages: 1
  });

  const formatJalaliDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  };

  const formatJalaliDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const mapApiRowToTableRow = (row) => ({
    id: row?.id,
    fullName: row?.fullName || '—',
    lastLogin: formatJalaliDateTime(row?.lastLogin),
    successfulRoutes: Number(row?.successfulRoutes || 0),
    totalRoutes: Number(row?.totalRoutes || 0),
    lastRoutingDate: formatJalaliDate(row?.lastRoutingDate),
    lastRouting: row?.lastRouting || '—'
  });

  // Load user logs
  const loadUserLogs = useCallback(async ({
    page = 1,
    pageSize = itemsPerPage,
    search = ''
  } = {}) => {
    setIsLoading(true);
    try {
      const data = await fetchAdminUserLogs({
        page,
        pageSize,
        search,
        sortBy: 'lastLogin',
        sortOrder: 'desc'
      });

      const rows = (data?.items || []).map(mapApiRowToTableRow);

      setUserLogs(rows);
      setPagination({
        page: data?.pagination?.page || page,
        pageSize: data?.pagination?.pageSize || pageSize,
        total: data?.pagination?.total || 0,
        pages: Math.max(1, data?.pagination?.pages || 1)
      });
      
    } catch (error) {
      console.error('خطا در دریافت لاگ‌های کاربران', error);
      toast.error(error?.response?.data?.message || 'خطا در دریافت لاگ‌های کاربران');
    } finally {
      setIsLoading(false);
    }
  }, [itemsPerPage]);

  // Handle refresh
  const handleRefreshTable = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setIsRefreshing(true);
    try {
      await loadUserLogs({ page: currentPage, pageSize: itemsPerPage, search: searchTerm });
      toast.success('جدول به روز رسانی شد');
    } catch (error) {
      console.error('به‌روزرسانی جدول ناموفق بود', error);
      toast.error('به‌روزرسانی جدول ناموفق بود');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  // Handle export to Excel
  const handleExportAllLogs = async () => {
    try {
      const blob = await exportAdminUserLogs({
        search: searchTerm || undefined,
        sortBy: 'lastLogin',
        sortOrder: 'desc'
      });

      const currentDate = new Date();
      const jalaliYear = currentDate.toLocaleDateString('fa-IR', { year: 'numeric' });
      const jalaliMonth = currentDate.toLocaleDateString('fa-IR', { month: '2-digit' });
      const jalaliDay = currentDate.toLocaleDateString('fa-IR', { day: '2-digit' });
      const filename = `گزارش_لاگ_مسیریابی_کاربران_${jalaliYear}${jalaliMonth}${jalaliDay}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('گزارش لاگ‌های مسیریابی با موفقیت دانلود شد');
    } catch (error) {
      console.error('خطا در ایجاد گزارش:', error);
      toast.error(error?.response?.data?.message || 'خطا در ایجاد گزارش');
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 6;

    if (pagination.pages <= maxVisiblePages) {
      for (let i = 1; i <= pagination.pages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(pagination.pages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  // Load logs on component mount and when dependencies change
  useEffect(() => {
    loadUserLogs({ page: currentPage, pageSize: itemsPerPage, search: searchTerm });
  }, [currentPage, itemsPerPage, searchTerm, loadUserLogs]);

  return (
    <div className="userlogs-section">
      <div className="section-header">
        <div className="section-header-top">
          <div className="title-container">
            <div className="title-cell">
              <h3>لاگ‌های مسیریابی کاربران در اپلیکیشن</h3>
              <button
                className="refresh-btn"
                onClick={handleRefreshTable}
                disabled={isRefreshing || isLoading}
                type="button"
                style={{ cursor: (isRefreshing || isLoading) ? 'wait' : 'pointer' }}
                title={(isRefreshing || isLoading) ? 'در حال به‌روزرسانی...' : 'به‌روزرسانی جدول'}
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
            <p></p>
          </div>
          <div className="left-container">
            <div className="search-box-with-icon">
              <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
              </svg>
              <input
                type="text"
                placeholder="جستجوی نام، آخرین مسیریابی و..."
                value={searchTerm}
                onChange={handleSearch}
                className="search-input7"
              />
            </div>

            <button className="seeInfo-btn" onClick={handleExportAllLogs}>
              مشاهده همه گزارش
            </button>
          </div>
        </div>
      </div>

      <div className="userlogs-table-container">
        <table className="userlogs-table">
          <thead>
            <tr>
              <th>نام و نام خانوادگی</th>
              <th>تاریخ آخرین ورود</th>
              <th>مسیریابی‌های موفق</th>
              <th>مسیریابی‌های انجام شده</th>
              <th>تاریخ آخرین مسیریابی</th>
              <th>آخرین مسیریابی</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="loading-cell">
                  <div style={{
                    width: '30px',
                    height: '30px',
                    border: '3px solid #f3f3f3',
                    borderTop: '3px solid #1E2023',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '20px auto'
                  }}></div>
                </td>
              </tr>
            ) : userLogs.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data-cell">
                  هیچ داده‌ای یافت نشد
                </td>
              </tr>
            ) : (
              userLogs.map(log => (
                <tr key={log.id}>
                  <td>
                    <div className="user-profile-cell">
                      <div className="profile-image-small3">
                        <svg fill="#ffffff" width="40px" height="40px" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                          <path d="M30.61,24.52a17.16,17.16,0,0,0-25.22,0,1.51,1.51,0,0,0-.39,1v6A1.5,1.5,0,0,0,6.5,33h23A1.5,1.5,0,0,0,31,31.5v-6A1.51,1.51,0,0,0,30.61,24.52Z" className="clr-i-solid clr-i-solid-path-1"></path>
                          <circle cx="18" cy="10" r="7" className="clr-i-solid clr-i-solid-path-2"></circle>
                          <rect x="0" y="0" width="36" height="36" fillOpacity="0" />
                        </svg>
                      </div>
                      <strong>{log.fullName}</strong>
                    </div>
                  </td>
                  <td>{log.lastLogin}</td>
                  <td>
                    <span className="success-count-userlogs">
                      {log.successfulRoutes} بار
                    </span>
                  </td>
                  <td>
                    <span className="total-routes-count">
                      {log.totalRoutes} بار
                    </span>
                  </td>
                  <td>{log.lastRoutingDate}</td>
                  <td>
                    <span className="last-route-info">
                      {log.lastRouting}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination controls */}
        <div className="pagination-container">
          <div className="pagination-controls">
            <div className="btc">
              <button
                className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                  <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                </svg>
              </button>

              <button
                className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                  <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === 1 ? "#C5C5C5" : "#0F71EF"} />
                </svg>
              </button>
            </div>

            <div className="page-numbers">
              {getPageNumbers().map(page => (
                <button
                  key={page}
                  className={`page-number ${currentPage === page ? 'active' : ''}`}
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </button>
              ))}
            </div>

            <div className="btc">
              <button
                className={`pagination-btn ${currentPage === pagination.pages ? 'disabled' : ''}`}
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.pages}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === pagination.pages ? "#C5C5C5" : "#0F71EF"} />
                </svg>
              </button>

              <button
                className={`pagination-btn ${currentPage === pagination.pages ? 'disabled' : ''}`}
                onClick={() => handlePageChange(pagination.pages)}
                disabled={currentPage === pagination.pages}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === pagination.pages ? "#C5C5C5" : "#0F71EF"} />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Userlogs;
