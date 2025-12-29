// src/pages/Usersigned.jsx
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import '../AdminPanel/Amain.css';

function Usersigned() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);

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

  // Sample data for demonstration with more users
  useEffect(() => {
    const mockUsers = [
      {
        id: 1,
        fullName: 'سیدمحمدحسین میرشفیعی',
        phone: '۹۱۹۳۹۳۷۸۶۹ ۹۸+',
        registerDate: '۱۵ تیر ۱۴۰۴',
        lastLogin: '۲۰ مهر ۱۴۰۴',
        gender: 'مرد',
        successCount: 8
      },
      {
        id: 2,
        fullName: 'محمدجواد سلگی',
        phone: '۹۱۹۳۹۳۷۸۶۹ ۹۸+',
        registerDate: '۲۰ مرداد ۱۴۰۴',
        lastLogin: '۱۹ مهر ۱۴۰۴',
        gender: 'مرد',
        successCount: 12
      },
      {
        id: 3,
        fullName: 'محمد رضایی',
        phone: '۴۹۳۸۷۶۵۴۳۲ ۹۸+',
        registerDate: '۱۰ شهریور ۱۴۰۴',
        lastLogin: '۱۸ مهر ۱۴۰۴',
        gender: 'مرد',
        successCount: 5
      },
      {
        id: 4,
        fullName: 'ساسان جاجرمی',
        phone: '۹۱۹۳۹۳۷۸۶۹ ۹۸+',
        registerDate: '۲۵ شهریور ۱۴۰۴',
        lastLogin: '۱۷ مهر ۱۴۰۴',
        gender: 'مرد',
        successCount: 15
      },
      {
        id: 5,
        fullName: 'مرتضی یوسف نیا',
        phone: '۹۱۹۳۹۳۷۸۶۹ ۹۸+',
        registerDate: '۵ مهر ۱۴۰۴',
        lastLogin: '۱۶ مهر ۱۴۰۴',
        gender: 'مرد',
        successCount: 3
      },
      {
        id: 6,
        fullName: 'فاطمه محمدی',
        phone: '۹۱۲۳۴۵۶۷۸۹ ۹۸+',
        registerDate: '۱۵ شهریور ۱۴۰۴',
        lastLogin: '۲۲ مهر ۱۴۰۴',
        gender: 'زن',
        successCount: 9
      },
      {
        id: 7,
        fullName: 'زهرا احمدی',
        phone: '۹۱۳۵۷۹۲۴۶۸ ۹۸+',
        registerDate: '۱۰ مهر ۱۴۰۴',
        lastLogin: '۲۵ مهر ۱۴۰۴',
        gender: 'زن',
        successCount: 11
      },
      {
        id: 8,
        fullName: 'علی کریمی',
        phone: '۹۱۴۶۸۲۵۳۹۷ ۹۸+',
        registerDate: '۲۵ مهر ۱۴۰۴',
        lastLogin: '۳۰ مهر ۱۴۰۴',
        gender: 'مرد',
        successCount: 7
      },
      {
        id: 9,
        fullName: 'حمید رضوانی',
        phone: '۹۱۵۷۳۹۴۶۸۲ ۹۸+',
        registerDate: '۲۰ شهریور ۱۴۰۴',
        lastLogin: '۲۸ مهر ۱۴۰۴',
        gender: 'مرد',
        successCount: 14
      },
      {
        id: 10,
        fullName: 'نرجس قاسمی',
        phone: '۹۱۶۸۲۴۵۷۳۹ ۹۸+',
        registerDate: '۲۵ مهر ۱۴۰۴',
        lastLogin: '۱ آبان ۱۴۰۴',
        gender: 'زن',
        successCount: 6
      },
    ];
    setUsers(mockUsers);
    setFilteredUsers(mockUsers);
  }, []);

  // Handle search
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    applyFilters(value, selectedGender, startDate, endDate);
  };

  // Handle gender filter change
  const handleGenderChange = (e) => {
    const gender = e.target.value;
    setSelectedGender(gender);
    applyFilters(searchTerm, gender, startDate, endDate);
  };


  const parseJalaliDate = (dateStr) => {

    const parts = dateStr.split(' ');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const monthName = parts[1];
    const year = parseInt(parts[2], 10);

    const monthIndex = jalaliMonths.indexOf(monthName) + 1;
    if (monthIndex === 0) return null;

    return { year, month: monthIndex, day };
  };


  const compareJalaliDates = (date1, date2) => {
    if (!date1 || !date2) return 0;

    if (date1.year !== date2.year) return date1.year - date2.year;
    if (date1.month !== date2.month) return date1.month - date2.month;
    return date1.day - date2.day;
  };


  const applyFilters = (search, gender, start, end) => {
    let filtered = [...users];


    if (search.trim()) {
      filtered = filtered.filter(user =>
        user.fullName.toLowerCase().includes(search.toLowerCase()) ||
        user.phone.includes(search)
      );
    }


    if (gender !== 'همه') {
      filtered = filtered.filter(user => user.gender === gender);
    }


    if (start && end) {
      filtered = filtered.filter(user => {
        const registerDate = parseJalaliDate(user.registerDate);
        if (!registerDate) return false;

        const isAfterStart = compareJalaliDates(registerDate, start) >= 0;
        const isBeforeEnd = compareJalaliDates(registerDate, end) <= 0;

        return isAfterStart && isBeforeEnd;
      });
    }

    setFilteredUsers(filtered);
    setCurrentPage(1);
  };


  const handleDetailsClick = (user) => {
    setSelectedUser({
      ...user,
      birthDate: '۱۳۷۵/۵/۲۰',
      email: 'user.email@example.com',
      province: 'خراسان رضوی',
      city: 'مشهد'
    });
    setShowUserModal(true);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);


    setTimeout(() => {

      const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
      setUsers(shuffledUsers);
      applyFilters(searchTerm, selectedGender, startDate, endDate);
      setIsRefreshing(false);
      toast.success('جدول به روز رسانی شد');
    }, 1000);
  };


  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedGender('همه');
    setStartDate(null);
    setEndDate(null);
    setShowStartCalendar(false);
    setShowEndCalendar(false);
    setFilteredUsers(users);
    toast.info('همه فیلترها پاک شدند');
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

      // Prepare data
      const data = filteredUsers.map(user => [
        user.fullName,
        `+۹۸ ${user.phone.replace('۹۸+', '').trim()}`,
        user.registerDate,
        user.lastLogin,
        user.gender,
        `${user.successCount} بار`
      ]);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet([
        ['نام و نام خانوادگی', 'شماره تماس', 'تاریخ ثبت نام', 'آخرین ورود', 'جنسیت', 'مسیریابی موفق'],
        ...data
      ]);

      // Column widths
      ws['!cols'] = [
        { wch: 30 }, { wch: 20 }, { wch: 18 },
        { wch: 18 }, { wch: 15 }, { wch: 18 }
      ];

      // Row heights
      const rowCount = data.length + 1;
      ws['!rows'] = Array(rowCount).fill().map((_, i) =>
        i === 0 ? { hpt: 25 } : { hpt: 22 }
      );

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
          horizontal: 'right', // RTL alignment for Persian text
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
            // Header row - center aligned
            ws[cell_ref].s = headerStyle;
          } else {
            // Data rows - right aligned for Persian text
            // Alternate colors for better readability
            ws[cell_ref].s = R % 2 === 1 ? altDataStyle : dataStyle;
          }
        }
      }

      // Create workbook with RTL sheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'کاربران');

      // Add workbook view for RTL
      wb.Workbook = wb.Workbook || {};
      wb.Workbook.Views = wb.Workbook.Views || [];
      wb.Workbook.Views.push({
        RTL: true // Set workbook to RTL mode
      });

      // Add sheet view for RTL
      ws['!views'] = ws['!views'] || [];
      ws['!views'].push({
        rightToLeft: true // Set sheet to RTL
      });

      // Generate and download
      XLSX.writeFile(wb, `گزارش_کاربران_${new Date().toLocaleDateString('fa-IR')}.xlsx`);

      toast.success('گزارش Excel با موفقیت دانلود شد');
    } catch (error) {
      console.error('خطا در ایجاد گزارش:', error);
      toast.error('خطا در ایجاد گزارش');
    }
  };

  // Calendar functions
  const jalaliMonthStart = (year, month) => {
    // Simplified calculation for Jalali calendar
    const mod = (year - (month < 7 ? 474 : 473)) % 2820;
    return (mod + 38) * 682 % 2816 < 682 ? 1 : 0;
  };

  const jalaliMonthLength = (year, month) => {
    if (month < 7) return 31;
    if (month < 12) return 30;
    // Check for leap year (simplified)
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
      // Auto-show end calendar after start date is selected
      setTimeout(() => setShowEndCalendar(true), 100);
    } else if (showEndCalendar && startDate) {
      setEndDate(selectedDate);
      setShowEndCalendar(false);
      applyFilters(searchTerm, selectedGender, startDate, selectedDate);
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

    // Empty cells for days before start of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        (startDate && startDate.year === year && startDate.month === month && startDate.day === day) ||
        (endDate && endDate.year === year && endDate.month === month && endDate.day === day);

      const isInRange = startDate && endDate && compareJalaliDates(
        { year, month, day },
        startDate
      ) >= 0 && compareJalaliDates(
        { year, month, day },
        endDate
      ) <= 0;

      const classes = [
        'calendar-day',
        isSelected ? 'selected' : '',
        isInRange && !isSelected ? 'in-range' : ''
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

  // Close calendar when clicking outside
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

  // Pagination functions
  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

  // Calculate pagination data
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Generate page numbers to display
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

  return (
    <div className="usersigned-page">
      {/* Report Filters Section */}
      <div className="reports-section">
        <div className="report-filters">
          <div className="filter-row">
            {/* Date Filter */}
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

                {/* Calendar for date selection */}
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

            {/* Gender Filter */}
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

      {/* User Search and Table */}
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
              <p></p>
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
              {currentUsers.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className="user-profile-cell">
                      <div className="profile-image-small3">
                        <svg fill="#ffffff" width="40px" height="40px" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                          <path d="M30.61,24.52a17.16,17.16,0,0,0-25.22,0,1.51,1.51,0,0,0-.39,1v6A1.5,1.5,0,0,0,6.5,33h23A1.5,1.5,0,0,0,31,31.5v-6A1.51,1.51,0,0,0,30.61,24.52Z" class="clr-i-solid clr-i-solid-path-1"></path>
                          <circle cx="18" cy="10" r="7" class="clr-i-solid clr-i-solid-path-2"></circle>
                          <rect x="0" y="0" width="36" height="36" fill-opacity="0" />
                        </svg>
                      </div>
                      <strong>{user.fullName}</strong>
                    </div>
                  </td>
                  <td>{user.phone}</td>
                  <td>{user.registerDate}</td>
                  <td>{user.lastLogin}</td>
                  <td>{user.gender}</td>
                  <td>
                    <span className="success-count-userssigned">
                      {user.successCount} بار
                    </span>
                  </td>
                  <td>
                    <button className="details-btn" onClick={() => handleDetailsClick(user)}>
                      جزئیات بیشتر
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M11.0176 3.63828C11.2404 3.82922 11.2662 4.1646 11.0752 4.38737L7.12156 8.99997L11.0752 13.6126C11.2662 13.8353 11.2404 14.1707 11.0176 14.3617C10.7948 14.5526 10.4595 14.5268 10.2685 14.304L6.01851 9.3457C5.84798 9.14675 5.84798 8.85318 6.01851 8.65424L10.2685 3.6959C10.4595 3.47314 10.7948 3.44734 11.0176 3.63828Z" fill="#1E2023" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
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
                  className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M10.3254 2.95375C10.1157 2.77404 9.80007 2.79832 9.62036 3.00799L5.62036 7.67465C5.45987 7.8619 5.45987 8.1382 5.62036 8.32544L9.62036 12.9921C9.80007 13.2018 10.1157 13.2261 10.3254 13.0463C10.535 12.8666 10.5593 12.551 10.3796 12.3413L6.65853 8.00005L10.3796 3.65878C10.5593 3.44912 10.535 3.13347 10.3254 2.95375Z" fill={currentPage === totalPages ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>

                <button
                  className={`pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`}
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M11.6584 2.95363C11.4487 2.77392 11.1331 2.7982 10.9534 3.00787L6.95337 7.67453C6.79287 7.86178 6.79287 8.13808 6.95337 8.32532L10.9534 12.992C11.1331 13.2017 11.4487 13.2259 11.6584 13.0462C11.8681 12.8665 11.8923 12.5509 11.7126 12.3412L7.99154 7.99993L11.7126 3.65866C11.8923 3.44899 11.8681 3.13334 11.6584 2.95363ZM8.9916 2.9537C8.78193 2.77399 8.46628 2.79827 8.28657 3.00793L4.28657 7.6746C4.12608 7.86185 4.12608 8.13815 4.28657 8.32539L8.28657 12.9921C8.46628 13.2017 8.78193 13.226 8.9916 13.0463C9.20126 12.8666 9.22554 12.5509 9.04583 12.3413L5.32474 8L9.04583 3.65873C9.22554 3.44906 9.20126 3.13341 8.9916 2.9537Z" fill={currentPage === totalPages ? "#C5C5C5" : "#0F71EF"} />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showUserModal && selectedUser && (
        <div className="user-details-modal-overlay" onClick={() => setShowUserModal(false)}>
          <div
            className="user-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="user-details-modal-header">
              <h3>جزئیات کاربر</h3>
            </div>

            <div className="modal-content">
              {/* User Profile Section */}
              <div className="user-profile-section">
                <div className="profile-image-large3">
                  <svg fill="#ffffff" width="40px" height="40px" viewBox="0 0 36 36" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
                    <path d="M30.61,24.52a17.16,17.16,0,0,0-25.22,0,1.51,1.51,0,0,0-.39,1v6A1.5,1.5,0,0,0,6.5,33h23A1.5,1.5,0,0,0,31,31.5v-6A1.51,1.51,0,0,0,30.61,24.52Z" class="clr-i-solid clr-i-solid-path-1"></path>
                    <circle cx="18" cy="10" r="7" class="clr-i-solid clr-i-solid-path-2"></circle>
                    <rect x="0" y="0" width="36" height="36" fill-opacity="0" />
                  </svg>
                </div>
                <div className="user-basic-info">
                  <h4>{selectedUser.fullName}</h4>
                  <span className="detail-label">تاریخ ثبت نام: </span>
                  <span className="detail-value">{selectedUser.registerDate}</span>
                </div>
              </div>

              {/* User Details Grid */}
              <div className="user-details-grid">
                <div className="detail-item">
                  <span className="detail-label">شماره تماس:</span>
                  <span className="detail-value">{selectedUser.phone}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">آخرین ورود:</span>
                  <span className="detail-value">{selectedUser.lastLogin}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">جنسیت:</span>
                  <span className="detail-value">{selectedUser.gender}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">مسیریابی موفق:</span>
                  <span className="detail-value success-badge">
                    {selectedUser.successCount} بار
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">تاریخ تولد:</span>
                  <span className="detail-value">{selectedUser.birthDate || 'ثبت نشده'}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">آدرس ایمیل:</span>
                  <span className="detail-value">
                    {selectedUser.email || <span className="empty-field">ثبت نشده</span>}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">استان:</span>
                  <span className="detail-value">
                    {selectedUser.province || <span className="empty-field">ثبت نشده</span>}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">شهر:</span>
                  <span className="detail-value">
                    {selectedUser.city || <span className="empty-field">ثبت نشده</span>}
                  </span>
                </div>
              </div>

              {/* Additional Info Section */}
              <div className="additional-info-section">
                <h4>اطلاعات تکمیلی</h4>
                <div className="info-cards">
                  <div className="info-card">
                    <span className="info-label">تعداد مسیرهای ذخیره شده:</span>
                    <span className="info-value3">{Math.floor(Math.random() * 10) + 1}</span>
                  </div>
                  <div className="info-card">
                    <span className="info-label">تعداد بازدید از مکان‌ها:</span>
                    <span className="info-value3">{Math.floor(Math.random() * 50) + 10}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="modal-close-button-usersigned"
                onClick={() => setShowUserModal(false)}
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