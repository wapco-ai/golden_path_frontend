import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';
import {
  fetchSignedUser,
  fetchSignedUsers,
  updateSignedUserStatus
} from '../api/adminUsers.api';

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
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
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailUserId, setDetailUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState({ current_page: 1, per_page: 20, last_page: 1, total: 0 });
  const [updatingMap, setUpdatingMap] = useState({});

  // Date filter states
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);
  const [calendarDate, setCalendarDate] = useState({ year: 1403, month: 7 });

  // Gender filter state
  const [selectedGender, setSelectedGender] = useState('همه');

  const calendarRef = useRef(null);
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);

  // Jalali month names
  const jalaliMonths = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  // Jalali weekdays starting from Saturday
  const jalaliWeekdays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

  const fetchUsers = async (searchValue = '', pageValue = currentPage) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetchSignedUsers({
        page: pageValue,
        pageSize: itemsPerPage,
        search: searchValue
      });

      const nextRows = response?.data || [];
      const nextMeta = response?.meta || { current_page: pageValue, per_page: itemsPerPage, last_page: 1, total: 0 };

      setUsers(nextRows);
      setFilteredUsers(nextRows);
      setMeta(nextMeta);

      if (nextMeta?.current_page && nextMeta.current_page !== currentPage) {
        setCurrentPage(nextMeta.current_page);
      }
    } catch (err) {
      const message = getErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchTerm.trim(), currentPage);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm, currentPage]);

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Handle gender filter change (UI only)
  const handleGenderChange = (e) => {
    const gender = e.target.value;
    setSelectedGender(gender);
  };

  const handleDetailsClick = async (userId) => {
    setSelectedUser(null);
    setShowUserModal(true);
    setDetailLoading(true);
    setDetailError('');
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
    setShowUserModal(false);
    setDetailUserId(null);
    setSelectedUser(null);
    setDetailError('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUsers(searchTerm.trim(), currentPage);
    setIsRefreshing(false);
    toast.success('جدول به روز رسانی شد');
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedGender('همه');
    setStartDate(null);
    setEndDate(null);
    setShowStartCalendar(false);
    setShowEndCalendar(false);
    setCurrentPage(1);
    fetchUsers('', 1);
    toast.info('همه فیلترها پاک شدند');
  };

  const handleExportToExcel = async () => {
    try {
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

      const data = filteredUsers.map(user => [
        user.name || '—',
        user.mobile || '—',
        user.email || '—',
        getStatusValue(user) === 'active' ? 'فعال' : 'غیرفعال',
        formatDateTime(user.createdAt),
        formatDateTime(user.lastLoginAt)
      ]);

      const ws = XLSX.utils.aoa_to_sheet([
        ['نام', 'شماره تماس', 'ایمیل', 'وضعیت', 'تاریخ ثبت نام', 'آخرین ورود'],
        ...data
      ]);

      ws['!cols'] = [
        { wch: 30 }, { wch: 20 }, { wch: 25 },
        { wch: 12 }, { wch: 20 }, { wch: 20 }
      ];

      const rowCount = data.length + 1;
      ws['!rows'] = Array(rowCount).fill().map((_, i) =>
        i === 0 ? { hpt: 25 } : { hpt: 22 }
      );

      const headerStyle = {
        font: {
          name: 'Tahoma',
          sz: 12,
          bold: true,
          color: { rgb: 'FFFFFF' }
        },
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { rgb: '1E40AF' }
        },
        alignment: {
          horizontal: 'center',
          vertical: 'center',
          readingOrder: 2
        },
        border: {
          top: { style: 'thin', color: { rgb: 'FFFFFF' } },
          bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
          left: { style: 'thin', color: { rgb: 'FFFFFF' } },
          right: { style: 'thin', color: { rgb: 'FFFFFF' } }
        }
      };

      const dataStyle = {
        font: {
          name: 'Tahoma',
          sz: 11,
          color: { rgb: '000000' }
        },
        alignment: {
          horizontal: 'right',
          vertical: 'center',
          readingOrder: 2
        },
        border: {
          top: { style: 'thin', color: { rgb: 'CCCCCC' } },
          bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
          left: { style: 'thin', color: { rgb: 'CCCCCC' } },
          right: { style: 'thin', color: { rgb: 'CCCCCC' } }
        }
      };

      const altDataStyle = {
        ...dataStyle,
        fill: {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { rgb: 'F3F4F6' }
        }
      };

      const range = XLSX.utils.decode_range(ws['!ref']);

      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          if (!ws[cellRef]) continue;
          if (R === 0) {
            ws[cellRef].s = headerStyle;
          } else {
            ws[cellRef].s = R % 2 === 1 ? altDataStyle : dataStyle;
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'کاربران');

      wb.Workbook = wb.Workbook || {};
      wb.Workbook.Views = wb.Workbook.Views || [];
      wb.Workbook.Views.push({ RTL: true });

      ws['!views'] = ws['!views'] || [];
      ws['!views'].push({ rightToLeft: true });

      XLSX.writeFile(wb, `گزارش_کاربران_${new Date().toLocaleDateString('fa-IR')}.xlsx`);

      toast.success('گزارش Excel با موفقیت دانلود شد');
    } catch (error) {
      console.error('خطا در ایجاد گزارش:', error);
      toast.error('خطا در ایجاد گزارش');
    }
  };

  // Calendar functions
  const jalaliMonthStart = (year, month) => {
    const mod = (year - (month < 7 ? 474 : 473)) % 2820;
    return (mod + 38) * 682 % 2816 < 682 ? 1 : 0;
  };

  const jalaliMonthLength = (year, month) => {
    if (month < 7) return 31;
    if (month < 12) return 30;
    const mod = year % 33;
    const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes(mod);
    return isLeap ? 30 : 29;
  };

  const handlePrevMonth = () => {
    setCalendarDate(prev => {
      let newMonth = prev.month - 1;
      let newYear = prev.year;
      if (newMonth < 1) {
        newMonth = 12;
        newYear--;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const handleNextMonth = () => {
    setCalendarDate(prev => {
      let newMonth = prev.month + 1;
      let newYear = prev.year;
      if (newMonth > 12) {
        newMonth = 1;
        newYear++;
      }
      return { ...prev, month: newMonth, year: newYear };
    });
  };

  const handleDaySelect = (day) => {
    const selectedDate = {
      year: calendarDate.year,
      month: calendarDate.month,
      day
    };

    if (showStartCalendar) {
      setStartDate(selectedDate);
      setShowStartCalendar(false);
      setTimeout(() => setShowEndCalendar(true), 100);
    } else if (showEndCalendar && startDate) {
      setEndDate(selectedDate);
      setShowEndCalendar(false);
    }
  };

  const handleStartDateClick = () => {
    setShowStartCalendar(!showStartCalendar);
    setShowEndCalendar(false);
  };

  const handleEndDateClick = () => {
    if (!startDate) {
      toast.error('لطفا ابتدا تاریخ شروع را انتخاب کنید');
      return;
    }
    setShowEndCalendar(!showEndCalendar);
    setShowStartCalendar(false);
  };

  const renderCalendarDays = () => {
    const { year, month } = calendarDate;
    const firstDay = jalaliMonthStart(year, month);
    const daysInMonth = jalaliMonthLength(year, month);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        (startDate && startDate.year === year && startDate.month === month && startDate.day === day) ||
        (endDate && endDate.year === year && endDate.month === month && endDate.day === day);

      const classes = [
        'calendar-day',
        isSelected ? 'selected' : ''
      ].filter(Boolean).join(' ');

      days.push(
        <div
          key={`day-${day}`}
          className={classes}
          onClick={() => handleDaySelect(day)}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current &&
        !calendarRef.current.contains(event.target) &&
        !startDateRef.current?.contains(event.target) &&
        !endDateRef.current?.contains(event.target)) {
        setShowStartCalendar(false);
        setShowEndCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const totalPages = meta?.last_page || 1;
  const totalItems = meta?.total || 0;
  const currentUsers = filteredUsers;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 6;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 2);
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  const handleToggleStatus = async (user) => {
    const currentStatus = getStatusValue(user);
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

    setUpdatingMap((prev) => ({ ...prev, [user.id]: true }));
    setFilteredUsers((prev) =>
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
      setFilteredUsers((prev) =>
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

  return (
    <div className="usersigned-page">
      <div className="reports-section">
        <div className="report-filters">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">انتخاب تاریخ</label>
              <div className="date-input-with-separator" ref={calendarRef}>
                <div className="dtg">
                  <span
                    ref={startDateRef}
                    className="date-start"
                    onClick={handleStartDateClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {startDate ? `${startDate.day} ${jalaliMonths[startDate.month - 1]} ${startDate.year}` : 'شروع'}
                  </span>
                  <div className="date-separator"></div>
                  <span
                    ref={endDateRef}
                    className="date-end"
                    onClick={handleEndDateClick}
                    style={{
                      cursor: startDate ? 'pointer' : 'not-allowed',
                      opacity: startDate ? 1 : 0.5
                    }}
                  >
                    {endDate ? `${endDate.day} ${jalaliMonths[endDate.month - 1]} ${endDate.year}` : 'پایان'}
                  </span>
                </div>

                {(showStartCalendar || showEndCalendar) && (
                  <div className="calendar-popup" style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '15px',
                    zIndex: '1000',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    minWidth: '280px',
                    marginTop: '5px'
                  }}>
                    <div className="calendar-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '15px'
                    }}>
                      <button onClick={handlePrevMonth} className="calendar-nav-btn" style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                        color: '#333'
                      }}>
                        ‹
                      </button>
                      <span className="calendar-title" style={{
                        fontWeight: 'bold',
                        fontSize: '16px'
                      }}>
                        {jalaliMonths[calendarDate.month - 1]} {calendarDate.year}
                      </span>
                      <button onClick={handleNextMonth} className="calendar-nav-btn" style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '20px',
                        cursor: 'pointer',
                        color: '#333'
                      }}>
                        ›
                      </button>
                    </div>

                    <div className="calendar-weekdays" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      gap: '5px',
                      marginBottom: '10px'
                    }}>
                      {jalaliWeekdays.map((day, index) => (
                        <div key={index} className="weekday" style={{
                          textAlign: 'center',
                          fontWeight: 'bold',
                          fontSize: '14px',
                          color: '#666'
                        }}>{day}</div>
                      ))}
                    </div>

                    <div className="calendar-days" style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      gap: '5px'
                    }}>
                      {renderCalendarDays()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="filter-group2">
              <label className="filter-label">انتخاب جنسیت</label>
              <div className="select-wrapper">
                <select value={selectedGender} onChange={handleGenderChange}>
                  <option>همه</option>
                  <option>مرد</option>
                  <option>زن</option>
                </select>
              </div>
            </div>
          </div>

          <div className="filter-actions">
            <button className="clear-filters-btn" onClick={handleClearFilters}>
              پاک کردن فیلترها
            </button>
            <button className="export-report-btn" onClick={handleExportToExcel}>
              <p>خروجی گزارشات</p>
            </button>
          </div>
        </div>
      </div>

      <div className="users-section">
        <div className="section-header">
          <div className="section-header-top">
            <div className="title-container">
              <div className="title-cell">
                <h3>آخرین کاربران ثبت نام شده در اپلیکیشن</h3>
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
              <p>مجموع کاربران: {totalItems}</p>
            </div>
            <div className="left-container">
              <div className="search-box-with-icon">
                <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
                </svg>
                <input
                  type="text"
                  placeholder="جستجوی نام، نام خانوادگی و.."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="search-input7"
                />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-state" style={{ marginBottom: '16px' }}>
            <p>{error}</p>
            <button className="details-btn" onClick={() => fetchUsers(searchTerm.trim(), currentPage)}>تلاش دوباره</button>
          </div>
        )}

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>نام و نام خانوادگی</th>
                <th>شماره تماس</th>
                <th>تاریخ ثبت نام</th>
                <th>آخرین ورود</th>
                <th>جنسیت</th>
                <th>مسیریابی موفق</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="7">
                    <div className="loading-state" style={{ padding: '16px', textAlign: 'center' }}>
                      در حال دریافت اطلاعات...
                    </div>
                  </td>
                </tr>
              )}

              {!loading && currentUsers.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state" style={{ padding: '16px', textAlign: 'center' }}>
                      داده ای برای نمایش وجود ندارد.
                    </div>
                  </td>
                </tr>
              )}

              {!loading && currentUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-profile-cell">
                      <div className="profile-image-small3">
                        <svg fill="#ffffff" width="40px" height="40px" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                          <path d="M30.61,24.52a17.16,17.16,0,0,0-25.22,0,1.51,1.51,0,0,0-.39,1v6A1.5,1.5,0,0,0,6.5,33h23A1.5,1.5,0,0,0,31,31.5v-6A1.51,1.51,0,0,0,30.61,24.52Z" className="clr-i-solid clr-i-solid-path-1"></path>
                          <circle cx="18" cy="10" r="7" className="clr-i-solid clr-i-solid-path-2"></circle>
                          <rect x="0" y="0" width="36" height="36" fillOpacity="0" />
                        </svg>
                      </div>
                      <strong>{user.name || '—'}</strong>
                    </div>
                  </td>
                  <td>{user.mobile || '—'}</td>
                  <td>{formatDateTime(user.createdAt)}</td>
                  <td>{formatDateTime(user.lastLoginAt)}</td>
                  <td>{user.gender || '—'}</td>
                  <td>
                    <span className="success-count-userssigned">
                      {user.successCount ? `${user.successCount} بار` : '—'}
                    </span>
                  </td>
                  <td>
                    <button className="details-btn" onClick={() => handleDetailsClick(user.id)}>
                      جزئیات بیشتر
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M11.0176 3.63828C11.2404 3.82922 11.2662 4.1646 11.0752 4.38737L7.12156 8.99997L11.0752 13.6126C11.2662 13.8353 11.2404 14.1707 11.0176 14.3617C10.7948 14.5526 10.4595 14.5268 10.2685 14.304L6.01851 9.3457C5.84798 9.14675 5.84798 8.85318 6.01851 8.65424L10.2685 3.6959C10.4595 3.47314 10.7948 3.44734 11.0176 3.63828Z" fill="#1E2023" />
                      </svg>
                    </button>
                    <button
                      className="details-btn"
                      style={{ marginRight: '8px' }}
                      disabled={!!updatingMap[user.id]}
                      onClick={() => handleToggleStatus(user)}
                    >
                      {getStatusValue(user) === 'active' ? 'غیرفعال' : 'فعال'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination-container">
            <div className="pagination-controls">
              <div className="btc">
                <button
                  className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === 1 ? '#C5C5C5' : '#0F71EF'} />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === 1 ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'rotate(180deg)' }}>
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === 1 ? '#C5C5C5' : '#0F71EF'} />
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
                  className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === totalPages ? '#C5C5C5' : '#0F71EF'} />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === totalPages ? '#C5C5C5' : '#0F71EF'} />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showUserModal && (
        <div className="user-details-modal-overlay" onClick={handleCloseDetails}>
          <div
            className="user-details-modal"
            onClick={(e) => e.stopPropagation()}
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
                <>
                  <div className="user-profile-section">
                    <div className="profile-image-large3">
                      <svg fill="#ffffff" width="40px" height="40px" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                        <path d="M30.61,24.52a17.16,17.16,0,0,0-25.22,0,1.51,1.51,0,0,0-.39,1v6A1.5,1.5,0,0,0,6.5,33h23A1.5,1.5,0,0,0,31,31.5v-6A1.51,1.51,0,0,0,30.61,24.52Z" className="clr-i-solid clr-i-solid-path-1"></path>
                        <circle cx="18" cy="10" r="7" className="clr-i-solid clr-i-solid-path-2"></circle>
                        <rect x="0" y="0" width="36" height="36" fillOpacity="0" />
                      </svg>
                    </div>
                    <div className="user-basic-info">
                      <h4>{selectedUser.name || '—'}</h4>
                      <span className="detail-label">تاریخ ثبت نام: </span>
                      <span className="detail-value">{formatDateTime(selectedUser.createdAt)}</span>
                    </div>
                  </div>

                  <div className="user-details-grid">
                    <div className="detail-item">
                      <span className="detail-label">شماره تماس:</span>
                      <span className="detail-value">{selectedUser.mobile || '—'}</span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">آخرین ورود:</span>
                      <span className="detail-value">{formatDateTime(selectedUser.lastLoginAt)}</span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">جنسیت:</span>
                      <span className="detail-value">{selectedUser.gender || '—'}</span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">مسیریابی موفق:</span>
                      <span className="detail-value success-badge">
                        {selectedUser.successCount ? `${selectedUser.successCount} بار` : '—'}
                      </span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">نام کاربری:</span>
                      <span className="detail-value">{selectedUser.username || '—'}</span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">آدرس ایمیل:</span>
                      <span className="detail-value">
                        {selectedUser.email || <span className="empty-field">ثبت نشده</span>}
                      </span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">وضعیت:</span>
                      <span className="detail-value">
                        {getStatusValue(selectedUser) === 'active' ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>

                    <div className="detail-item">
                      <span className="detail-label">IP آخرین ورود:</span>
                      <span className="detail-value">
                        {selectedUser.lastLoginIp || <span className="empty-field">ثبت نشده</span>}
                      </span>
                    </div>
                  </div>

                  <div className="additional-info-section">
                    <h4>اطلاعات تکمیلی</h4>
                    <div className="info-cards">
                      <div className="info-card">
                        <span className="info-label">تعداد مسیرهای ذخیره شده:</span>
                        <span className="info-value3">{selectedUser.savedRoutesCount ?? '—'}</span>
                      </div>
                      <div className="info-card">
                        <span className="info-label">تعداد بازدید از مکان‌ها:</span>
                        <span className="info-value3">{selectedUser.placeVisitsCount ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                </>
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
