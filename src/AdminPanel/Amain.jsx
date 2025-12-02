// src/pages/Amain.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useIntl } from 'react-intl';
import '../AdminPanel/Amain.css';
import logo from '../assets/images/logo2.png';
import 'react-datepicker/dist/react-datepicker.css';
import { toJalaali, toGregorian } from 'jalaali-js';
import ReactDatePicker from 'react-datepicker';
import { Helmet } from 'react-helmet';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';


const Amain = () => {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [commentStats, setCommentStats] = useState({
    total: 152,
    approved: 89,
    rejected: 46
  });
  const [map, setMap] = useState(null);

  const [mapViewState, setMapViewState] = useState({
    longitude: 51.388,
    latitude: 35.6892,
    zoom: 12
  });
  const [mapType, setMapType] = useState('نمای خیابان');
  const [isMapTypeOpen, setIsMapTypeOpen] = useState(false);
  const unknownComments = commentStats.total - commentStats.approved - commentStats.rejected;
  const approvedDegrees = (commentStats.approved / commentStats.total) * 360;
  const rejectedDegrees = (commentStats.rejected / commentStats.total) * 360;
  const unknownDegrees = (unknownComments / commentStats.total) * 360;
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [userCultureOpen, setUserCultureOpen] = useState(false);
  const [reportsManagementOpen, setReportsManagementOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [placeIcon, setPlaceIcon] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [existingPlaces, setExistingPlaces] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const intl = useIntl();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarRef = useRef(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState(['منوی اصلی', 'داشبورد', 'آمار کلی استارتاپ من']);
  const [currentReportView, setCurrentReportView] = useState(null);
  const [pieChartTimeFilter, setPieChartTimeFilter] = useState('ماه اخیر');
  const [barChartTimeFilter, setBarChartTimeFilter] = useState('هفته اخیر');
  const [isPieChartFilterOpen, setIsPieChartFilterOpen] = useState(false);
  const [isBarChartFilterOpen, setIsBarChartFilterOpen] = useState(false);
  const [selectedBar, setSelectedBar] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const contentRef = useRef(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [isLocationMarkerMode, setIsLocationMarkerMode] = useState(false);
  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [placeCategory, setPlaceCategory] = useState('');
  const [placeSubcategory, setPlaceSubcategory] = useState('');
  const [placeFunction, setPlaceFunction] = useState('');
  const [selectedPlaceTypes, setSelectedPlaceTypes] = useState([]);
  const [selectedTransport, setSelectedTransport] = useState([]);
  const [selectedGenderAccess, setSelectedGenderAccess] = useState([]);
  const [timeRestrictions, setTimeRestrictions] = useState([]);
  const [prayerTimeRestrictions, setPrayerTimeRestrictions] = useState([]);



  // Sample data for demonstration
  useEffect(() => {
    // Mock user data
    const mockUsers = [
      {
        id: 1,
        fullName: 'سیدمحمدحسین میرشفیعی ',
        phone: ' ۹۱۹۳۹۳۷۸۶۹ ۹۸+',
        registerDate: ' ۱۸ مرداد ۱۴۰۴',
        gender: 'مرد'
      },
      {
        id: 2,
        fullName: 'محمدجواد سلگی',
        phone: '۹۱۹۳۹۳۷۸۶۹ ۹۸+',
        registerDate: '۲۰ مرداد ۱۴۰۴',
        gender: 'مرد'
      },
      {
        id: 3,
        fullName: 'محمد رضایی',
        phone: '۴۹۳۸۷۶۵۴۳۲ ۹۸+',
        registerDate: '۲۲ مرداد ۱۴۰۴',
        gender: 'مرد'
      },
      {
        id: 4,
        fullName: 'ساسان جاجرمی',
        phone: '۹۱۹۳۹۳۷۸۶۹ ۹۸+',
        registerDate: '۲۵ مرداد ۱۴۰۴',
        gender: 'مرد'
      },
      {
        id: 5,
        fullName: 'مرتضی یوسف نیا',
        phone: '۹۱۹۳۹۳۷۸۶۹ ۹۸+',
        registerDate: '۲۷ مرداد ۱۴۰۴',
        gender: 'مرد'
      },
    ];
    setUsers(mockUsers);
  }, []);

  const barData = [
    { day: 'شنبه', value: 70, count: 175 },
    { day: 'یکشنبه', value: 45, count: 112 },
    { day: 'دوشنبه', value: 85, count: 213 },
    { day: 'سه شنبه', value: 60, count: 150 },
    { day: 'چهارشنبه', value: 30, count: 75 },
    { day: 'پنجشنبه', value: 90, count: 225 },
    { day: 'جمعه', value: 50, count: 125 }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedBar !== null && !event.target.closest('.bar-chart-container')) {
        setSelectedBar(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedBar]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isPieChartFilterOpen &&
        !event.target.closest('.time-filter') &&
        !event.target.closest('.chart-filter')) {
        setIsPieChartFilterOpen(false);
      }
      if (isBarChartFilterOpen &&
        !event.target.closest('.time-filter') &&
        !event.target.closest('.chart-filter')) {
        setIsBarChartFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPieChartFilterOpen, isBarChartFilterOpen]);

  const toggleUserManagement = () => {
    setUserManagementOpen(!userManagementOpen);
  };

  const toggleUserCulture = () => {
    setUserCultureOpen(!userCultureOpen);
    if (!userCultureOpen) {
      setActiveMenu('culturemanage');
    }
  };

  const getPageTitle = () => {
    if (currentReportView === 'کاربران ثبت نام کرده') {
      return {
        title: 'گزارش کاربران ثبت نام کرده در نرم افزار مسیربایی حرم تا امروز',
        description: 'آزمون آئینسوم متن ساختگی با تولید سادگی نامفهوم از صنعت استفاده از طراحان گرافیک است چاپگرها'
      };
    }

    if (currentReportView === 'بارگذاری و ثبت محتوا') {
      return {
        title: 'بارگذاری و ثبت محتوای فرهنگی',
        description: 'مدیریت و ثبت اطلاعات کامل مکان‌های فرهنگی شامل مشخصات، رسانه‌ها و اطلاعات تکمیلی'
      };
    }

    if (activeMenu === 'mapmanage') {
      return {
        title: ' مدیریت نقشه و نقاط و مکان های حرم مطهر',
        description: 'لورم ایسدوم متن ساختگی با تولید سادگی نامفهوم از صنعت استفاده از طراحان گرافیک است چاپگرها'
      };
    }
    return {
      title: 'آمار و جزئیات کلی محصول مسیربایی حرم تا امروز',
      description: 'لورم ایسدوم متن ساختگی با تولید سادگی نامفهوم از صنعت استفاده از طراحان گرافیک است چاپگرها'
    };
  };

  const toggleReportsManagement = () => {
    setReportsManagementOpen(!reportsManagementOpen);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredUsers = users.filter(user =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleSubmenuClick = (viewName) => {
    setCurrentReportView(viewName);

    // Set the correct active menu based on which submenu was clicked
    if (viewName === 'کاربران ثبت نام کرده' ||
      viewName === 'لاگ های مسیریابی کاربران' ||
      viewName === 'نظرات ثبت شده کاربران') {
      setActiveMenu('reports');
      setBreadcrumbPath(['منوی اصلی', 'گزارشات', viewName]);
    } else if (viewName === 'بارگذاری و ثبت محتوا' ||
      viewName === 'ثبت ماهیت') {
      setActiveMenu('culturemanage');
      setBreadcrumbPath(['منوی اصلی', 'مدیریت اطلاعات فرهنگی', viewName]);

      // Reset form when switching to content upload
      if (viewName === 'بارگذاری و ثبت محتوا') {
        resetForm();
      }
    } else {
      // For other submenus like user management
      setActiveMenu('usermanage');
      setBreadcrumbPath(['منوی اصلی', 'مدیریت کاربران', viewName]);
    }
  };

  // Reset form function
  const resetForm = () => {
    setSelectedPlace(null);
    setPlaceName('');
    setPlaceAddress('');
    setOpeningTime('');
    setClosingTime('');
    setShortDescription('');
    setFullDescription('');
    setMediaFiles([]);
    setAdditionalNotes('');
    setPlaceIcon(null);
    setIsEditing(false);
    setPlaceCategory('');
    setPlaceSubcategory('');
    setPlaceFunction('');
    setSelectedPlaceTypes([]);
    setSelectedTransport([]);
    setSelectedGenderAccess([]);
    setTimeRestrictions([]);
    setPrayerTimeRestrictions([]);
    setCurrentStep(1);
  };

  // Handle media upload
  const handleMediaUpload = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file =>
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      file.type === 'image/gif'
    );
    setMediaFiles(prev => [...prev, ...validFiles]);
  };

  // Map initialization effect
  useEffect(() => {
    if (activeMenu === 'mapmanage') {
      // Initialize map when map management is active
      const initializeMap = () => {
        const mapInstance = new maplibregl.Map({
          container: 'map-container',
          style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json', // Default style
          center: [51.389, 35.6892], // Tehran coordinates
          zoom: 10
        });

        mapInstance.addControl(new maplibregl.NavigationControl());
        setMap(mapInstance);

        return () => {
          mapInstance.remove();
        };
      };

      if (document.getElementById('map-container')) {
        initializeMap();
      }
    } else {
      // Clean up map when leaving map management
      if (map) {
        map.remove();
        setMap(null);
      }
    }
  }, [activeMenu]);

  const handleZoomIn = () => {
    if (map) {
      map.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (map) {
      map.zoomOut();
    }
  };

  const handleGPS = () => {
    if (map && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        map.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 15
        });
      });
    }
  };

  const handleFullscreenMap = () => {
    setIsMapFullscreen(true);
  };

  const handleExitFullscreenMap = () => {
    setIsMapFullscreen(false);
  };

  // Handle icon upload
  const handleIconUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setPlaceIcon(file);
    }
  };

  // Remove media file
  const removeMediaFile = (index) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Search places
  const handleSearchPlaces = (e) => {
    setSearchQuery(e.target.value);
    // In real app, this would filter from API
  };

  const handleLocationMarkerSelect = () => {
    setIsLocationMarkerMode(true);
  };

  const handleCancelLocationMarker = () => {
    setIsLocationMarkerMode(false);
  };

  const handleAddPlaceToMarker = () => {
    setIsAddPlaceModalOpen(true);
    setCurrentStep(1);
    setIsLocationMarkerMode(false);
  };
  useEffect(() => {
    // Reset scroll position when menu changes
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    // Also reset window scroll
    window.scrollTo(0, 0);
  }, [activeMenu, currentReportView]);

  // Save place data
  const handleSavePlace = () => {
    // Here you would typically send data to API
    const placeData = {
      name: placeName,
      address: placeAddress,
      openingHours: { open: openingTime, close: closingTime },
      shortDescription,
      fullDescription,
      media: mediaFiles,
      additionalNotes,
      icon: placeIcon
    };

    console.log('Saving place data:', placeData);
    // Add API call here
    alert('اطلاعات با موفقیت ذخیره شد');
  };

  // Load place for editing
  const handleEditPlace = (place) => {
    setSelectedPlace(place);
    setPlaceName(place.name || '');
    setPlaceAddress(place.address || '');
    setOpeningTime(place.openingHours?.open || '');
    setClosingTime(place.openingHours?.close || '');
    setShortDescription(place.shortDescription || '');
    setFullDescription(place.fullDescription || '');
    setAdditionalNotes(place.additionalNotes || '');
    setIsEditing(true);
  };

  const handleMenuClick = (menuName, breadcrumbLabel) => {
    setActiveMenu(menuName);
    if (menuName === 'dashboard') {
      setCurrentReportView(null);
      setBreadcrumbPath(['منوی اصلی', breadcrumbLabel, 'آمار کلی استارتاپ من']);
    } else if (menuName === 'mapmanage') {
      setCurrentReportView(null);
      setBreadcrumbPath(['منوی اصلی', breadcrumbLabel]);
    } else {
      setCurrentReportView(null);
      const newPath = ['منوی اصلی', breadcrumbLabel];
      setBreadcrumbPath(newPath);
    }
  };

  const mapTypes = [
    'نمای خیابان',
    'نمای ماهواره',
    'نمای ترکیبی',
    'نمای شب',
    'نمای ساده'
  ];

  const formatJalaliDate = (date) => {
    const jalali = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());

    const jalaliMonths = [
      'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
      'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
    ];

    return `${jalali.jd} ${jalaliMonths[jalali.jm - 1]} ${jalali.jy}`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isCalendarOpen &&
        calendarRef.current &&
        !calendarRef.current.contains(event.target) &&
        // Also check if the click is not on the calendar button itself
        !event.target.closest('.calendar-btn')) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCalendarOpen]);

  useEffect(() => {
    // Chrome rendering fix
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    if (isChrome) {
      // Force reflow to fix rendering issues
      setTimeout(() => {
        document.body.style.zoom = '1';
        document.body.style.display = 'none';
        document.body.offsetHeight; // Trigger reflow
        document.body.style.display = 'block';
      }, 100);
    }
  }, []);

  const addTimeRestriction = () => {
    const newRestriction = {
      id: Date.now(),
      days: [],
      startTime: '',
      endTime: '',
      gender: ''
    };
    setTimeRestrictions([...timeRestrictions, newRestriction]);
  };

  const removeTimeRestriction = (id) => {
    setTimeRestrictions(timeRestrictions.filter(restriction => restriction.id !== id));
  };

  const addPrayerTimeRestriction = () => {
    const newRestriction = {
      id: Date.now(),
      prayerType: '',
      appliesToAllDays: true
    };
    setPrayerTimeRestrictions([...prayerTimeRestrictions, newRestriction]);
  };

  const removePrayerTimeRestriction = (id) => {
    setPrayerTimeRestrictions(prayerTimeRestrictions.filter(restriction => restriction.id !== id));
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Add this function to handle items per page change
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1); // Reset to first page when changing items per page
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
    <div className={`admin-panel admin-panel-isolated ${isMapFullscreen ? 'map-fullscreen' : ''}`}>
      <Helmet>
        <title>Admin Panel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Helmet>
      {/* Header */}
      <div className="admin-header">
        <div className="header-right">
          <div className="sidebar-logo">
            <img src={logo} alt="Logo" />
          </div>
          <div className="admin-profile">
            <div className="profile-image"></div>
            <div className="profile-info">
              <div className="admin-name" >
                <span>مصطفی شاملو</span>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.6921 7.09327C3.91674 6.83119 4.3113 6.80084 4.57338 7.02548L9.99997 11.6768L15.4266 7.02548C15.6886 6.80084 16.0832 6.83119 16.3078 7.09327C16.5325 7.35535 16.5021 7.74991 16.24 7.97455L10.4067 12.9745C10.1727 13.1752 9.82728 13.1752 9.59323 12.9745L3.75989 7.97455C3.49781 7.74991 3.46746 7.35535 3.6921 7.09327Z" fill="#1E2023" />
                </svg>
              </div>
              <div className="admin-role">ادمین . مدیر ارشد محصول</div>
            </div>
          </div>
        </div>
        <div className="header-left">
          <form className="search-box5">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="search-box5-icon">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
            </svg>

            <input
              type="text"
              placeholder="جستجو کنید ..."
              className="search-box5-input"
            />
          </form>
          <div className="notifications-btn">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M14.8549 2.09564C13.8149 2.09564 12.9719 2.93869 12.9719 3.97865C12.9719 5.01861 13.8149 5.86166 14.8549 5.86166C15.8948 5.86166 16.7379 5.01861 16.7379 3.97865C16.7379 2.93869 15.8948 2.09564 14.8549 2.09564ZM11.7165 3.97865C11.7165 2.24539 13.1216 0.840302 14.8549 0.840302C16.5881 0.840302 17.9932 2.24539 17.9932 3.97865C17.9932 5.71192 16.5881 7.117 14.8549 7.117C13.1216 7.117 11.7165 5.71192 11.7165 3.97865ZM7.27561 2.51409L9.8335 2.51409C10.1802 2.51409 10.4612 2.79511 10.4612 3.14176C10.4612 3.48841 10.1802 3.76943 9.8335 3.76943H7.32282C5.72701 3.76943 4.5933 3.77076 3.73326 3.88639C2.89127 3.99959 2.40616 4.21189 2.05198 4.56607C1.6978 4.92025 1.48551 5.40535 1.3723 6.24734C1.25667 7.10739 1.25534 8.2411 1.25534 9.83691C1.25534 11.4327 1.25667 12.5664 1.3723 13.4265C1.48551 14.2685 1.6978 14.7536 2.05198 15.1077C2.40616 15.4619 2.89127 15.6742 3.73326 15.7874C4.5933 15.9031 5.72701 15.9044 7.32282 15.9044H10.6704C12.2662 15.9044 13.3999 15.9031 14.26 15.7874C15.1019 15.6742 15.587 15.4619 15.9412 15.1077C16.2954 14.7536 16.5077 14.2685 16.6209 13.4265C16.7365 12.5664 16.7379 11.4327 16.7379 9.83691C16.7379 9.5248 16.7401 9.2968 16.7421 9.10081C16.7452 8.78343 16.7475 8.54995 16.7381 8.17907C16.7293 7.83253 17.0031 7.54446 17.3496 7.53565C17.6961 7.52684 17.9842 7.80063 17.993 8.14717C18.0029 8.53724 18.0004 8.80349 17.9972 9.13998C17.9953 9.33576 17.9932 9.55533 17.9932 9.83691V9.88412C17.9932 11.4221 17.9932 12.6403 17.8651 13.5937C17.7331 14.5749 17.4552 15.3691 16.8289 15.9954C16.2026 16.6217 15.4084 16.8996 14.4272 17.0316C13.4738 17.1597 12.2556 17.1597 10.7176 17.1597H7.27561C5.7376 17.1597 4.51939 17.1597 3.56598 17.0316C2.58479 16.8996 1.79062 16.6217 1.16432 15.9954C0.538022 15.3691 0.260076 14.5749 0.128158 13.5937C-2.35736e-05 12.6403 -1.29997e-05 11.4221 2.69156e-07 9.88412V9.78969C-1.29997e-05 8.25168 -2.35736e-05 7.03347 0.128158 6.08007C0.260076 5.09888 0.538022 4.30471 1.16432 3.67841C1.79062 3.05211 2.58479 2.77416 3.56598 2.64225C4.51939 2.51406 5.7376 2.51407 7.27561 2.51409ZM3.49306 6.08751C3.71498 5.8212 4.11076 5.78522 4.37707 6.00714L6.18384 7.51278C6.96462 8.16344 7.50671 8.61372 7.96437 8.90806C8.40738 9.19299 8.70782 9.28864 8.99661 9.28864C9.2854 9.28864 9.58583 9.19299 10.0288 8.90806C10.4865 8.61372 11.0286 8.16344 11.8094 7.51278C12.0757 7.29086 12.4715 7.32684 12.6934 7.59314C12.9153 7.85945 12.8793 8.25524 12.613 8.47716L12.5816 8.50337C11.8398 9.12155 11.2386 9.62259 10.7079 9.96388C10.1551 10.3194 9.61681 10.544 8.99661 10.544C8.3764 10.544 7.83807 10.3194 7.28531 9.96388C6.75467 9.6226 6.15344 9.12156 5.41166 8.50339L3.57342 6.97152C3.30711 6.7496 3.27113 6.35381 3.49306 6.08751Z" fill="#0F71EF" />
              <path d="M11.7165 3.97865C11.7165 2.24539 13.1216 0.840302 14.8549 0.840302C16.5881 0.840302 17.9932 2.24539 17.9932 3.97865C17.9932 5.71192 16.5881 7.117 14.8549 7.117C13.1216 7.117 11.7165 5.71192 11.7165 3.97865Z" fill="#03234D" />
            </svg>

            <span>اعلان ها</span>
            <div className="notification-badge">3</div>
          </div>
        </div>

      </div>

      <div className="admin-content-wrapper">
        {/* Sidebar */}
        <div className="admin-sidebar">


          <div className="sidebar-menu">
            <span className="menu-title3">
              منوی اصلی

            </span>
            <div
              id="dashboard-menu-item"
              className={`menu-item ${activeMenu === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleMenuClick('dashboard', 'داشبورد')}
            >
              <span className="menu-icon">
                <svg width="15" height="16" viewBox="0 0 15 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.42847 1.06232C3.98584 1.06232 4.37472 1.06308 4.67847 1.08478C4.97661 1.1061 5.14999 1.14536 5.28198 1.20294C5.67214 1.3732 5.98382 1.68484 6.15405 2.07501C6.21162 2.20702 6.2509 2.38036 6.27222 2.67853C6.29392 2.9823 6.29468 3.3711 6.29468 3.92853C6.29468 4.4859 6.29392 4.87478 6.27222 5.17853C6.25089 5.47668 6.21164 5.65005 6.15405 5.78204C5.98381 6.17222 5.67216 6.48387 5.28198 6.65411C5.14999 6.7117 4.97662 6.75095 4.67847 6.77228C4.37472 6.79398 3.98584 6.79474 3.42847 6.79474C2.87104 6.79474 2.48224 6.79398 2.17847 6.77228C1.8803 6.75096 1.70695 6.71168 1.57495 6.65411C1.18478 6.48388 0.873136 6.1722 0.702881 5.78204C0.645295 5.65006 0.606041 5.47667 0.584717 5.17853C0.563015 4.87478 0.562256 4.4859 0.562256 3.92853C0.562256 3.3711 0.563014 2.9823 0.584717 2.67853C0.606034 2.38031 0.645297 2.20702 0.702881 2.07501C0.873126 1.68481 1.18474 1.37319 1.57495 1.20294C1.70696 1.14536 1.88025 1.1061 2.17847 1.08478C2.48224 1.06308 2.87104 1.06232 3.42847 1.06232Z" stroke="black" strokeWidth="1.12501" />
                  <path d="M3.42847 9.2049C3.98584 9.2049 4.37472 9.20565 4.67847 9.22736C4.97661 9.24868 5.14999 9.28793 5.28198 9.34552C5.67214 9.51578 5.98382 9.82742 6.15405 10.2176C6.21162 10.3496 6.2509 10.5229 6.27222 10.8211C6.29392 11.1249 6.29468 11.5137 6.29468 12.0711C6.29468 12.6285 6.29392 13.0174 6.27222 13.3211C6.25089 13.6193 6.21164 13.7926 6.15405 13.9246C5.98381 14.3148 5.67216 14.6264 5.28198 14.7967C5.14999 14.8543 4.97662 14.8935 4.67847 14.9149C4.37472 14.9366 3.98584 14.9373 3.42847 14.9373C2.87104 14.9373 2.48224 14.9366 2.17847 14.9149C1.8803 14.8935 1.70695 14.8543 1.57495 14.7967C1.18478 14.6265 0.873136 14.3148 0.702881 13.9246C0.645295 13.7926 0.606041 13.6192 0.584717 13.3211C0.563015 13.0174 0.562256 12.6285 0.562256 12.0711C0.562256 11.5137 0.563014 11.1249 0.584717 10.8211C0.606034 10.5229 0.645297 10.3496 0.702881 10.2176C0.873126 9.82738 1.18474 9.51577 1.57495 9.34552C1.70696 9.28794 1.88025 9.24867 2.17847 9.22736C2.48224 9.20565 2.87104 9.2049 3.42847 9.2049Z" stroke="black" strokeWidth="1.12501" />
                  <path d="M11.5715 1.06232C12.1289 1.06232 12.5178 1.06308 12.8215 1.08478C13.1197 1.1061 13.2931 1.14536 13.425 1.20294C13.8152 1.3732 14.1269 1.68484 14.2971 2.07501C14.3547 2.20702 14.394 2.38036 14.4153 2.67853C14.437 2.9823 14.4377 3.3711 14.4377 3.92853C14.4377 4.4859 14.437 4.87478 14.4153 5.17853C14.394 5.47668 14.3547 5.65005 14.2971 5.78204C14.1269 6.17222 13.8152 6.48387 13.425 6.65411C13.2931 6.7117 13.1197 6.75095 12.8215 6.77228C12.5178 6.79398 12.1289 6.79474 11.5715 6.79474C11.0141 6.79474 10.6253 6.79398 10.3215 6.77228C10.0234 6.75096 9.85002 6.71168 9.71802 6.65411C9.32785 6.48388 9.0162 6.1722 8.84595 5.78204C8.78836 5.65006 8.74911 5.47667 8.72778 5.17853C8.70608 4.87478 8.70532 4.4859 8.70532 3.92853C8.70532 3.3711 8.70608 2.9823 8.72778 2.67853C8.7491 2.38031 8.78836 2.20702 8.84595 2.07501C9.01619 1.68481 9.32781 1.37319 9.71802 1.20294C9.85003 1.14536 10.0233 1.1061 10.3215 1.08478C10.6253 1.06308 11.0141 1.06232 11.5715 1.06232Z" stroke="black" strokeWidth="1.12501" />
                  <path d="M11.5715 9.2049C12.1289 9.2049 12.5178 9.20565 12.8215 9.22736C13.1197 9.24868 13.2931 9.28793 13.425 9.34552C13.8152 9.51578 14.1269 9.82742 14.2971 10.2176C14.3547 10.3496 14.394 10.5229 14.4153 10.8211C14.437 11.1249 14.4377 11.5137 14.4377 12.0711C14.4377 12.6285 14.437 13.0174 14.4153 13.3211C14.394 13.6193 14.3547 13.7926 14.2971 13.9246C14.1269 14.3148 13.8152 14.6264 13.425 14.7967C13.2931 14.8543 13.1197 14.8935 12.8215 14.9149C12.5178 14.9366 12.1289 14.9373 11.5715 14.9373C11.0141 14.9373 10.6253 14.9366 10.3215 14.9149C10.0234 14.8935 9.85002 14.8543 9.71802 14.7967C9.32785 14.6265 9.0162 14.3148 8.84595 13.9246C8.78836 13.7926 8.74911 13.6192 8.72778 13.3211C8.70608 13.0174 8.70532 12.6285 8.70532 12.0711C8.70532 11.5137 8.70608 11.1249 8.72778 10.8211C8.7491 10.5229 8.78836 10.3496 8.84595 10.2176C9.01619 9.82738 9.32781 9.51577 9.71802 9.34552C9.85003 9.28794 10.0233 9.24867 10.3215 9.22736C10.6253 9.20565 11.0141 9.2049 11.5715 9.2049Z" stroke="black" strokeWidth="1.12501" />
                </svg>
              </span>
              <span> داشبورد  </span>
            </div>

            <div className="menu-item with-submenu">

              <div
                className={`menu-item ${activeMenu === 'reports' ? 'active' : ''}`}
                onClick={() => {
                  toggleReportsManagement();
                  handleMenuClick('reports', 'گزارشات');
                }}
              >
                <span className="menu-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.19768 9.99579C3.19768 9.71643 3.42414 9.48997 3.70349 9.48997H9.09885C9.3782 9.48997 9.60466 9.71643 9.60466 9.99579C9.60466 10.2751 9.3782 10.5016 9.09885 10.5016H3.70349C3.42414 10.5016 3.19768 10.2751 3.19768 9.99579Z" fill="#858585" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.19768 12.3563C3.19768 12.0769 3.42414 11.8504 3.70349 11.8504H7.4128C7.69215 11.8504 7.91862 12.0769 7.91862 12.3563C7.91862 12.6356 7.69215 12.8621 7.4128 12.8621H3.70349C3.42414 12.8621 3.19768 12.6356 3.19768 12.3563Z" fill="#858585" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M7.91862 2.12812C7.60811 2.07536 7.18483 2.07136 6.42126 2.07136C5.12862 2.07136 4.20981 2.07242 3.51321 2.16565C2.83077 2.25699 2.43864 2.42831 2.15361 2.71334C1.86819 2.99876 1.69711 3.38968 1.60589 4.06821C1.5127 4.76129 1.51163 5.6749 1.51163 6.9609V9.65858C1.51163 10.9446 1.5127 11.8582 1.60589 12.5513C1.69711 13.2298 1.86819 13.6207 2.15361 13.9061C2.43903 14.1916 2.82996 14.3626 3.50848 14.4539C4.20156 14.547 5.11517 14.5481 6.40117 14.5481H9.09885C10.3848 14.5481 11.2985 14.547 11.9915 14.4539C12.6701 14.3626 13.061 14.1916 13.3464 13.9061C13.6318 13.6207 13.8029 13.2298 13.8941 12.5513C13.9873 11.8582 13.9884 10.9446 13.9884 9.65858V9.36379C13.9884 8.32787 13.9811 7.83679 13.8712 7.46671H11.7603C10.9963 7.46673 10.372 7.46674 9.87908 7.40047C9.36385 7.3312 8.91716 7.18129 8.5606 6.82473C8.20404 6.46817 8.05413 6.02148 7.98486 5.50625C7.91859 5.01334 7.9186 4.38901 7.91862 3.62501V2.12812ZM8.93025 2.65099V3.5888C8.93025 4.39791 8.93132 4.95386 8.98746 5.37146C9.04165 5.7745 9.13866 5.97213 9.27593 6.1094C9.4132 6.24667 9.61083 6.34368 10.0139 6.39786C10.4315 6.45401 10.9874 6.45508 11.7965 6.45508H13.1585C12.9586 6.26116 12.7024 6.0288 12.3698 5.72942L9.69991 3.32653C9.37256 3.03192 9.12892 2.81445 8.93025 2.65099ZM6.5195 1.05971C7.4533 1.05946 8.0566 1.0593 8.61187 1.27237C9.16712 1.48545 9.61354 1.88744 10.3042 2.50939C10.3281 2.53086 10.3522 2.5526 10.3766 2.57459L13.0465 4.97748C13.0749 5.00306 13.103 5.02832 13.1308 5.05326C13.929 5.77128 14.4453 6.23558 14.7229 6.85904C15.0006 7.48249 15.0004 8.17678 15 9.25047C15 9.28778 15 9.32555 15 9.36379V9.69662C15 10.936 15 11.9178 14.8967 12.6861C14.7904 13.4768 14.5665 14.1168 14.0617 14.6215C13.557 15.1262 12.917 15.3502 12.1263 15.4565C11.358 15.5598 10.3763 15.5598 9.1369 15.5597H6.36313C5.1237 15.5598 4.142 15.5598 3.37369 15.4565C2.58298 15.3502 1.94299 15.1262 1.43828 14.6215C0.933571 14.1168 0.709585 13.4768 0.603277 12.6861C0.499981 11.9178 0.49999 10.936 0.5 9.69663V6.92285C0.49999 5.68343 0.499981 4.70172 0.603277 3.93341C0.709585 3.14271 0.933571 2.50272 1.43828 1.99801C1.94339 1.4929 2.58552 1.26916 3.37901 1.16296C4.15052 1.05971 5.13711 1.05972 6.38331 1.05973L6.42126 1.05973C6.45442 1.05973 6.48716 1.05972 6.5195 1.05971Z" fill="#858585" />
                    <path d="M7.91862 2.12812H8.01862V2.04368L7.93537 2.02953L7.91862 2.12812ZM3.51321 2.16565L3.49994 2.06654L3.51321 2.16565ZM2.15361 2.71334L2.0829 2.64263L2.15361 2.71334ZM1.60589 4.06821L1.50678 4.05489H1.50678L1.60589 4.06821ZM1.60589 12.5513L1.50678 12.5646H1.50678L1.60589 12.5513ZM2.15361 13.9061L2.22432 13.8354H2.22432L2.15361 13.9061ZM3.50848 14.4539L3.52181 14.3548L3.50848 14.4539ZM11.9915 14.4539L11.9782 14.3548L11.9915 14.4539ZM13.8941 12.5513L13.795 12.5379L13.8941 12.5513ZM13.8712 7.46671L13.967 7.43823L13.9458 7.36671H13.8712V7.46671ZM11.7603 7.46671V7.36671H11.7603L11.7603 7.46671ZM9.87908 7.40047L9.86575 7.49958L9.87908 7.40047ZM8.5606 6.82473L8.48989 6.89544L8.5606 6.82473ZM7.98486 5.50625L7.88575 5.51958L7.98486 5.50625ZM7.91862 3.62501L8.01862 3.62501V3.62501H7.91862ZM8.93025 2.65099L8.99378 2.57376L8.83025 2.43921V2.65099H8.93025ZM8.98746 5.37146L8.88836 5.38478L8.98746 5.37146ZM10.0139 6.39786L10.0272 6.29876L10.0139 6.39786ZM13.1585 6.45508V6.55508H13.4052L13.2281 6.38331L13.1585 6.45508ZM12.3698 5.72942L12.3029 5.80375L12.3698 5.72942ZM9.69991 3.32653L9.7668 3.2522L9.69991 3.32653ZM8.61187 1.27237L8.64769 1.17901V1.17901L8.61187 1.27237ZM6.5195 1.05971L6.51953 1.15971L6.5195 1.05971ZM10.3042 2.50939L10.2373 2.5837L10.2373 2.5837L10.3042 2.50939ZM10.3766 2.57459L10.3098 2.64892V2.64892L10.3766 2.57459ZM13.0465 4.97748L12.9796 5.05181V5.05181L13.0465 4.97748ZM13.1308 5.05326L13.1976 4.97891V4.97891L13.1308 5.05326ZM14.7229 6.85904L14.6316 6.89972V6.89972L14.7229 6.85904ZM15 9.25047L15.1 9.2505V9.2505L15 9.25047ZM15 9.69662H14.9V9.69662L15 9.69662ZM14.8967 12.6861L14.7976 12.6727L14.8967 12.6861ZM14.0617 14.6215L13.991 14.5508L13.991 14.5508L14.0617 14.6215ZM12.1263 15.4565L12.113 15.3574L12.1263 15.4565ZM9.1369 15.5597L9.1369 15.4597H9.1369V15.5597ZM6.36313 15.5597V15.4597H6.36313L6.36313 15.5597ZM3.37369 15.4565L3.38701 15.3574L3.37369 15.4565ZM1.43828 14.6215L1.50899 14.5508V14.5508L1.43828 14.6215ZM0.603277 12.6861L0.702386 12.6727H0.702386L0.603277 12.6861ZM0.5 9.69663L0.6 9.69663V9.69663H0.5ZM0.5 6.92285H0.6V6.92285L0.5 6.92285ZM0.603277 3.93341L0.504169 3.92009L0.603277 3.93341ZM1.43828 1.99801L1.50899 2.06872L1.43828 1.99801ZM3.37901 1.16296L3.36575 1.06385L3.37901 1.16296ZM6.38331 1.05973L6.38331 1.15973H6.38331L6.38331 1.05973ZM6.42126 1.05973L6.42126 1.15973H6.42126V1.05973ZM3.70349 9.48997V9.38997C3.36891 9.38997 3.09768 9.6612 3.09768 9.99579H3.19768H3.29768C3.29768 9.77166 3.47937 9.58997 3.70349 9.58997V9.48997ZM9.09885 9.48997V9.38997H3.70349V9.48997V9.58997H9.09885V9.48997ZM9.60466 9.99579H9.70467C9.70467 9.6612 9.43343 9.38997 9.09885 9.38997V9.48997V9.58997C9.32298 9.58997 9.50466 9.77166 9.50466 9.99579H9.60466ZM9.09885 10.5016V10.6016C9.43343 10.6016 9.70467 10.3304 9.70467 9.99579H9.60466H9.50466C9.50466 10.2199 9.32298 10.4016 9.09885 10.4016V10.5016ZM3.70349 10.5016V10.6016H9.09885V10.5016V10.4016H3.70349V10.5016ZM3.19768 9.99579H3.09768C3.09768 10.3304 3.36891 10.6016 3.70349 10.6016V10.5016V10.4016C3.47937 10.4016 3.29768 10.2199 3.29768 9.99579H3.19768ZM3.70349 11.8504V11.7504C3.36891 11.7504 3.09768 12.0217 3.09768 12.3563H3.19768H3.29768C3.29768 12.1321 3.47937 11.9504 3.70349 11.9504V11.8504ZM7.4128 11.8504V11.7504H3.70349V11.8504V11.9504H7.4128V11.8504ZM7.91862 12.3563H8.01862C8.01862 12.0217 7.74738 11.7504 7.4128 11.7504V11.8504V11.9504C7.63693 11.9504 7.81862 12.1321 7.81862 12.3563H7.91862ZM7.4128 12.8621V12.9621C7.74738 12.9621 8.01862 12.6908 8.01862 12.3563H7.91862H7.81862C7.81862 12.5804 7.63693 12.7621 7.4128 12.7621V12.8621ZM3.70349 12.8621V12.9621H7.4128V12.8621V12.7621H3.70349V12.8621ZM3.19768 12.3563H3.09768C3.09768 12.6908 3.36891 12.9621 3.70349 12.9621V12.8621V12.7621C3.47937 12.7621 3.29768 12.5804 3.29768 12.3563H3.19768ZM6.42126 2.07136V2.17136C7.18843 2.17136 7.60166 2.17569 7.90186 2.22671L7.91862 2.12812L7.93537 2.02953C7.61456 1.97502 7.18123 1.97136 6.42126 1.97136V2.07136ZM3.51321 2.16565L3.52647 2.26477C4.21489 2.17263 5.12576 2.17136 6.42126 2.17136V2.07136V1.97136C5.13148 1.97136 4.20473 1.97221 3.49994 2.06654L3.51321 2.16565ZM2.15361 2.71334L2.22432 2.78405C2.48762 2.52076 2.85506 2.35463 3.52647 2.26477L3.51321 2.16565L3.49994 2.06654C2.80648 2.15935 2.38966 2.33587 2.0829 2.64263L2.15361 2.71334ZM1.60589 4.06821L1.70499 4.08153C1.79472 3.41414 1.96056 3.04781 2.22432 2.78405L2.15361 2.71334L2.0829 2.64263C1.77583 2.9497 1.5995 3.36522 1.50678 4.05489L1.60589 4.06821ZM1.51163 6.9609H1.61163C1.61163 5.67203 1.61292 4.76639 1.70499 4.08153L1.60589 4.06821L1.50678 4.05489C1.41249 4.75618 1.41163 5.67777 1.41163 6.9609H1.51163ZM1.51163 9.65858H1.61163V6.9609H1.51163H1.41163V9.65858H1.51163ZM1.60589 12.5513L1.70499 12.5379C1.61292 11.8531 1.61163 10.9474 1.61163 9.65858H1.51163H1.41163C1.41163 10.9417 1.41249 11.8633 1.50678 12.5646L1.60589 12.5513ZM2.15361 13.9061L2.22432 13.8354C1.96056 13.5717 1.79472 13.2053 1.70499 12.5379L1.60589 12.5513L1.50678 12.5646C1.5995 13.2543 1.77583 13.6698 2.0829 13.9768L2.15361 13.9061ZM3.50848 14.4539L3.52181 14.3548C2.85442 14.265 2.48809 14.0992 2.22432 13.8354L2.15361 13.9061L2.0829 13.9768C2.38998 14.2839 2.8055 14.4602 3.49516 14.553L3.50848 14.4539ZM6.40117 14.5481V14.4481C5.11231 14.4481 4.20666 14.4468 3.52181 14.3548L3.50848 14.4539L3.49516 14.553C4.19646 14.6473 5.11804 14.6481 6.40117 14.6481V14.5481ZM9.09885 14.5481V14.4481H6.40117V14.5481V14.6481H9.09885V14.5481ZM11.9915 14.4539L11.9782 14.3548C11.2934 14.4468 10.3877 14.4481 9.09885 14.4481V14.5481V14.6481C10.382 14.6481 11.3036 14.6473 12.0049 14.553L11.9915 14.4539ZM13.3464 13.9061L13.2757 13.8354C13.0119 14.0992 12.6456 14.265 11.9782 14.3548L11.9915 14.4539L12.0049 14.553C12.6945 14.4602 13.11 14.2839 13.4171 13.9768L13.3464 13.9061ZM13.8941 12.5513L13.795 12.5379C13.7053 13.2053 13.5395 13.5717 13.2757 13.8354L13.3464 13.9061L13.4171 13.9768C13.7242 13.6698 13.9005 13.2543 13.9932 12.5646L13.8941 12.5513ZM13.9884 9.65858H13.8884C13.8884 10.9474 13.8871 11.8531 13.795 12.5379L13.8941 12.5513L13.9932 12.5646C14.0875 11.8633 14.0884 10.9417 14.0884 9.65858H13.9884ZM13.9884 9.36379H13.8884V9.65858H13.9884H14.0884V9.36379H13.9884ZM13.8712 7.46671L13.7753 7.49519C13.8801 7.8479 13.8884 8.32115 13.8884 9.36379H13.9884H14.0884C14.0884 8.33459 14.0821 7.82568 13.967 7.43823L13.8712 7.46671ZM9.87908 7.40047L9.86575 7.49958C10.3668 7.56695 10.9989 7.56673 11.7603 7.56671L11.7603 7.46671L11.7603 7.36671C10.9937 7.36673 10.3772 7.36654 9.8924 7.30137L9.87908 7.40047ZM8.5606 6.82473L8.48989 6.89544C8.86815 7.2737 9.33949 7.42883 9.86575 7.49958L9.87908 7.40047L9.8924 7.30137C9.38822 7.23358 8.96617 7.08888 8.63131 6.75402L8.5606 6.82473ZM7.98486 5.50625L7.88575 5.51958C7.9565 6.04584 8.11163 6.51718 8.48989 6.89544L8.5606 6.82473L8.63131 6.75402C8.29645 6.41916 8.15175 5.99711 8.08396 5.49293L7.98486 5.50625ZM7.91862 3.62501L7.81862 3.62501C7.8186 4.38645 7.81838 5.01852 7.88575 5.51958L7.98486 5.50625L8.08396 5.49293C8.01879 5.00817 8.0186 4.39158 8.01862 3.62501L7.91862 3.62501ZM8.93025 3.5888H9.03025V2.65099H8.93025H8.83025V3.5888H8.93025ZM8.98746 5.37146L9.08657 5.35813C9.03154 4.94876 9.03025 4.4008 9.03025 3.5888H8.93025H8.83025C8.83025 4.39502 8.83111 4.95896 8.88836 5.38478L8.98746 5.37146ZM9.27593 6.1094L9.34664 6.03869C9.231 5.92306 9.13926 5.75 9.08657 5.35813L8.98746 5.37146L8.88836 5.38478C8.94405 5.799 9.04631 6.0212 9.20522 6.18011L9.27593 6.1094ZM10.0139 6.39786L10.0272 6.29876C9.63533 6.24607 9.46227 6.15433 9.34664 6.03869L9.27593 6.1094L9.20522 6.18011C9.36413 6.33902 9.58633 6.44128 10.0005 6.49697L10.0139 6.39786ZM11.7965 6.45508V6.35508C10.9845 6.35508 10.4366 6.3538 10.0272 6.29876L10.0139 6.39786L10.0005 6.49697C10.4264 6.55422 10.9903 6.55508 11.7965 6.55508V6.45508ZM13.1585 6.45508V6.35508H11.7965V6.45508V6.55508H13.1585V6.45508ZM12.3698 5.72942L12.3029 5.80375C12.6358 6.10334 12.8905 6.33446 13.0889 6.52686L13.1585 6.45508L13.2281 6.38331C13.0266 6.18786 12.7691 5.95425 12.4367 5.65509L12.3698 5.72942ZM9.69991 3.32653L9.63301 3.40086L12.3029 5.80375L12.3698 5.72942L12.4367 5.65509L9.7668 3.2522L9.69991 3.32653ZM8.93025 2.65099L8.86671 2.72821C9.06335 2.89 9.30529 3.10591 9.63301 3.40086L9.69991 3.32653L9.7668 3.2522C9.43983 2.95792 9.19449 2.73889 8.99378 2.57376L8.93025 2.65099ZM8.61187 1.27237L8.64769 1.17901C8.07151 0.957909 7.44742 0.959461 6.51948 0.959709L6.5195 1.05971L6.51953 1.15971C7.45919 1.15946 8.0417 1.16069 8.57604 1.36574L8.61187 1.27237ZM10.3042 2.50939L10.3711 2.43508C9.68477 1.81701 9.22386 1.40011 8.64769 1.17901L8.61187 1.27237L8.57604 1.36574C9.11039 1.57079 9.54232 1.95787 10.2373 2.5837L10.3042 2.50939ZM10.3766 2.57459L10.4435 2.50026C10.4191 2.47828 10.395 2.45655 10.3711 2.43508L10.3042 2.50939L10.2373 2.5837C10.2612 2.60517 10.2853 2.62691 10.3098 2.64892L10.3766 2.57459ZM13.0465 4.97748L13.1134 4.90315L10.4435 2.50026L10.3766 2.57459L10.3098 2.64892L12.9796 5.05181L13.0465 4.97748ZM13.1308 5.05326L13.1976 4.97891C13.1699 4.95396 13.1418 4.92872 13.1134 4.90315L13.0465 4.97748L12.9796 5.05181C13.0081 5.0774 13.0362 5.10267 13.0639 5.12761L13.1308 5.05326ZM14.7229 6.85904L14.8143 6.81836C14.5261 6.17139 13.9908 5.69234 13.1976 4.97891L13.1308 5.05326L13.0639 5.12761C13.8673 5.85022 14.3644 6.29977 14.6316 6.89972L14.7229 6.85904ZM15 9.25047L15.1 9.2505C15.1004 8.18368 15.1024 7.46531 14.8143 6.81836L14.7229 6.85904L14.6316 6.89972C14.8988 7.49967 14.9004 8.16989 14.9 9.25043L15 9.25047ZM15 9.36379H15.1C15.1 9.32556 15.1 9.28781 15.1 9.2505L15 9.25047L14.9 9.25043C14.9 9.28774 14.9 9.32553 14.9 9.36379H15ZM14.8967 12.6861L14.9959 12.6994C15.1002 11.9229 15.1 10.9334 15.1 9.69662L15 9.69662L14.9 9.69662C14.9 10.9387 14.8998 11.9126 14.7976 12.6727L14.8967 12.6861ZM14.0617 14.6215L14.1324 14.6922C14.6589 14.1658 14.8881 13.5012 14.9959 12.6994L14.8967 12.6861L14.7976 12.6727C14.6928 13.4524 14.474 14.0677 13.991 14.5508L14.0617 14.6215ZM12.1263 15.4565L12.1397 15.5556C12.9414 15.4478 13.606 15.2186 14.1325 14.6922L14.0617 14.6215L13.991 14.5508C13.508 15.0338 12.8927 15.2525 12.113 15.3574L12.1263 15.4565ZM9.1369 15.5597L9.13689 15.6597C10.3737 15.6598 11.3632 15.66 12.1397 15.5556L12.1263 15.4565L12.113 15.3574C11.3529 15.4596 10.379 15.4598 9.1369 15.4597L9.1369 15.5597ZM3.37369 15.4565L3.36036 15.5556C4.13684 15.66 5.12637 15.6598 6.36313 15.6597L6.36313 15.5597L6.36313 15.4597C5.12104 15.4598 4.14715 15.4596 3.38701 15.3574L3.37369 15.4565ZM1.43828 14.6215L1.36757 14.6922C1.89397 15.2186 2.5586 15.4478 3.36036 15.5556L3.37369 15.4565L3.38701 15.3574C2.60736 15.2525 1.99201 15.0338 1.50899 14.5508L1.43828 14.6215ZM0.603277 12.6861L0.504169 12.6994C0.611963 13.5012 0.841169 14.1658 1.36757 14.6922L1.43828 14.6215L1.50899 14.5508C1.02597 14.0677 0.807206 13.4524 0.702386 12.6727L0.603277 12.6861ZM0.5 9.69663L0.4 9.69662C0.39999 10.9334 0.399774 11.9229 0.504169 12.6994L0.603277 12.6861L0.702386 12.6727C0.600188 11.9126 0.59999 10.9387 0.6 9.69663L0.5 9.69663ZM0.603277 3.93341L0.504169 3.92009C0.399774 4.69657 0.39999 5.68609 0.4 6.92285L0.5 6.92285L0.6 6.92285C0.59999 5.68077 0.600188 4.70687 0.702386 3.94674L0.603277 3.93341ZM1.43828 1.99801L1.36757 1.9273C0.841169 2.4537 0.611963 3.11833 0.504169 3.92009L0.603277 3.93341L0.702386 3.94674C0.807206 3.16709 1.02597 2.55174 1.50899 2.06872L1.43828 1.99801ZM3.37901 1.16296L3.36575 1.06385C2.56131 1.17151 1.89445 1.40042 1.36757 1.9273L1.43828 1.99801L1.50899 2.06872C1.99233 1.58538 2.60973 1.36681 3.39228 1.26208L3.37901 1.16296ZM6.38331 1.05973L6.38331 0.959726C5.13976 0.959716 4.14539 0.959502 3.36575 1.06385L3.37901 1.16296L3.39228 1.26208C4.15565 1.15991 5.13446 1.15972 6.38331 1.15973L6.38331 1.05973ZM6.42126 1.05973L6.42127 0.959727L6.38331 0.959726L6.38331 1.05973L6.38331 1.15973L6.42126 1.15973L6.42126 1.05973ZM6.5195 1.05971L6.51948 0.959709C6.48713 0.959718 6.4544 0.959727 6.42126 0.959727V1.05973V1.15973C6.45443 1.15973 6.48719 1.15972 6.51953 1.15971L6.5195 1.05971ZM11.7603 7.46671V7.56671H13.8712V7.46671V7.36671H11.7603V7.46671ZM7.91862 2.12812H7.81862V3.62501H7.91862H8.01862V2.12812H7.91862ZM15 9.69662H15.1V9.36379H15H14.9V9.69662H15ZM6.36313 15.5597V15.6597H9.1369V15.5597V15.4597H6.36313V15.5597ZM0.5 6.92285H0.4V9.69663H0.5H0.6V6.92285H0.5Z" fill="#858585" />
                  </svg>

                </span>
                <span>گزارشات</span>
                <svg className={`submenu-arrow ${reportsManagementOpen ? 'open' : ''}`} width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M2.95363 5.98434C3.13334 5.77467 3.44899 5.75039 3.65866 5.9301L7.99993 9.65119L12.3412 5.9301C12.5509 5.75039 12.8665 5.77467 13.0462 5.98434C13.2259 6.194 13.2017 6.50965 12.992 6.68936L8.32532 10.6894C8.13808 10.8499 7.86178 10.8499 7.67453 10.6894L3.00787 6.68936C2.7982 6.50965 2.77392 6.194 2.95363 5.98434Z" fill="#858585" />
                </svg>

              </div>
              {reportsManagementOpen && (
                <div className="submenu-items">
                  <div
                    className={`submenu-item ${currentReportView === 'کاربران ثبت نام کرده' ? 'active' : ''}`}
                    onClick={() => handleSubmenuClick('کاربران ثبت نام کرده')}
                  >
                    <div className="submenu-branch"></div>
                    <span>کاربران ثبت نام کرده</span>
                  </div>
                  <div className="submenu-item">
                    <div className="submenu-branch"></div>
                    <span>لاگ های مسیریابی کاربران</span>
                  </div>
                  <div className="submenu-item">
                    <div className="submenu-branch"></div>
                    <span>نظرات ثبت شده کاربران</span>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`menu-item ${activeMenu === 'mapmanage' ? 'active' : ''}`}
              onClick={() => handleMenuClick('mapmanage', 'مدیریت نقشه')}
            >
              <span className="menu-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M11.5906 1.95089C10.724 1.83438 9.58516 1.83331 7.99967 1.83331C6.41419 1.83331 5.27538 1.83438 4.40873 1.95089C3.55646 2.06548 3.04264 2.28341 2.66287 2.66318C2.2831 3.04295 2.06517 3.55676 1.95059 4.40903C1.83407 5.27568 1.83301 6.4145 1.83301 7.99998C1.83301 9.58546 1.83407 10.7243 1.95059 11.5909C2.06517 12.4432 2.2831 12.957 2.66287 13.3368C2.97462 13.6485 3.3767 13.8512 3.98218 13.9772L13.9769 3.98249C13.8509 3.37701 13.6482 2.97493 13.3365 2.66318C12.9567 2.28341 12.4429 2.06548 11.5906 1.95089ZM14.1245 5.24908L10.0404 9.3332L13.6452 12.938C13.8416 12.6052 13.9698 12.1785 14.0488 11.5909C14.1653 10.7243 14.1663 9.58546 14.1663 7.99998C14.1663 6.88096 14.1658 5.98444 14.1245 5.24908ZM12.9382 13.6452L9.33331 10.0403L5.24877 14.1248C5.98414 14.1661 6.88065 14.1666 7.99967 14.1666C9.58516 14.1666 10.724 14.1656 11.5906 14.0491C12.1785 13.97 12.6053 13.8418 12.9382 13.6452ZM11.7239 0.959811C12.687 1.0893 13.447 1.35953 14.0436 1.95607C14.6401 2.55261 14.9103 3.31263 15.0398 4.27578C15.1664 5.21678 15.1663 6.4228 15.1663 7.96173V8.03823C15.1663 9.57716 15.1664 10.7832 15.0398 11.7242C14.9103 12.6873 14.6401 13.4473 14.0436 14.0439C13.447 14.6404 12.687 14.9107 11.7239 15.0401C10.7829 15.1667 9.57685 15.1667 8.03792 15.1666H7.96143C6.4225 15.1667 5.21647 15.1667 4.27548 15.0401C3.31232 14.9107 2.55231 14.6404 1.95577 14.0439C1.35923 13.4473 1.089 12.6873 0.959506 11.7242C0.832993 10.7832 0.832999 9.57716 0.833008 8.03823V7.96173C0.832999 6.4228 0.832992 5.21677 0.959505 4.27578C1.089 3.31263 1.35923 2.55261 1.95577 1.95607C2.5523 1.35953 3.31232 1.0893 4.27548 0.959811C5.21647 0.833298 6.42249 0.833305 7.96142 0.833313H8.03793C9.57685 0.833304 10.7829 0.833298 11.7239 0.959811ZM3.16634 5.83812C3.16634 4.32944 4.46931 3.16658 5.99967 3.16658C7.53004 3.16658 8.83301 4.32944 8.83301 5.83812C8.83301 7.18897 8.00247 8.7833 6.62285 9.37288C6.22648 9.54226 5.77287 9.54226 5.3765 9.37288C3.99688 8.7833 3.16634 7.18897 3.16634 5.83812ZM5.99967 4.16658C4.95271 4.16658 4.16634 4.94819 4.16634 5.83812C4.16634 6.8671 4.82524 8.04981 5.76947 8.45332C5.91483 8.51544 6.08452 8.51544 6.22988 8.45332C7.17411 8.04981 7.83301 6.8671 7.83301 5.83812C7.83301 4.94819 7.04664 4.16658 5.99967 4.16658Z" fill="#858585" />
                  <path d="M6.66634 5.99998C6.66634 6.36817 6.36786 6.66665 5.99967 6.66665C5.63148 6.66665 5.33301 6.36817 5.33301 5.99998C5.33301 5.63179 5.63148 5.33331 5.99967 5.33331C6.36786 5.33331 6.66634 5.63179 6.66634 5.99998Z" fill="#858585" />
                </svg>


              </span>
              <span>مدیریت نقشه</span>
            </div>


            <div className="menu-item with-submenu">
              <div
                className={`menu-item ${activeMenu === 'usermanage' ? 'active' : ''}`}
                onClick={() => {
                  toggleUserManagement();
                  handleMenuClick('usermanage', 'مدیریت کاربران');
                }}
              >
                <span className="menu-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.00033 0.833313C6.25142 0.833313 4.83366 2.25108 4.83366 3.99998C4.83366 5.74888 6.25142 7.16665 8.00033 7.16665C9.74923 7.16665 11.167 5.74888 11.167 3.99998C11.167 2.25108 9.74923 0.833313 8.00033 0.833313ZM5.83366 3.99998C5.83366 2.80336 6.80371 1.83331 8.00033 1.83331C9.19694 1.83331 10.167 2.80336 10.167 3.99998C10.167 5.1966 9.19694 6.16665 8.00033 6.16665C6.80371 6.16665 5.83366 5.1966 5.83366 3.99998Z" fill="#858585" />
                    <path d="M12.0003 2.16665C11.7242 2.16665 11.5003 2.3905 11.5003 2.66665C11.5003 2.94279 11.7242 3.16665 12.0003 3.16665C12.918 3.16665 13.5003 3.77047 13.5003 4.33331C13.5003 4.89616 12.918 5.49998 12.0003 5.49998C11.7242 5.49998 11.5003 5.72384 11.5003 5.99998C11.5003 6.27612 11.7242 6.49998 12.0003 6.49998C13.2918 6.49998 14.5003 5.61142 14.5003 4.33331C14.5003 3.05521 13.2918 2.16665 12.0003 2.16665Z" fill="#858585" />
                    <path d="M4.50033 2.66665C4.50033 2.3905 4.27647 2.16665 4.00033 2.16665C2.70884 2.16665 1.50033 3.05521 1.50033 4.33331C1.50033 5.61142 2.70884 6.49998 4.00033 6.49998C4.27647 6.49998 4.50033 6.27612 4.50033 5.99998C4.50033 5.72384 4.27647 5.49998 4.00033 5.49998C3.08267 5.49998 2.50033 4.89616 2.50033 4.33331C2.50033 3.77047 3.08267 3.16665 4.00033 3.16665C4.27647 3.16665 4.50033 2.94279 4.50033 2.66665Z" fill="#858585" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.00033 8.16665C6.81081 8.16665 5.71129 8.48717 4.89455 9.03167C4.0813 9.57384 3.50033 10.3777 3.50033 11.3333C3.50033 12.2889 4.0813 13.0928 4.89455 13.635C5.71129 14.1795 6.81081 14.5 8.00033 14.5C9.18984 14.5 10.2894 14.1795 11.1061 13.635C11.9194 13.0928 12.5003 12.2889 12.5003 11.3333C12.5003 10.3777 11.9194 9.57384 11.1061 9.03167C10.2894 8.48717 9.18984 8.16665 8.00033 8.16665ZM4.50033 11.3333C4.50033 10.8161 4.81478 10.2867 5.44925 9.86372C6.08022 9.44307 6.9807 9.16665 8.00033 9.16665C9.01995 9.16665 9.92043 9.44307 10.5514 9.86372C11.1859 10.2867 11.5003 10.8161 11.5003 11.3333C11.5003 11.8505 11.1859 12.3799 10.5514 12.8029C9.92043 13.2236 9.01995 13.5 8.00033 13.5C6.9807 13.5 6.08022 13.2236 5.44925 12.8029C4.81478 12.3799 4.50033 11.8505 4.50033 11.3333Z" fill="#858585" />
                    <path d="M12.8453 9.22621C12.9044 8.95648 13.171 8.78577 13.4408 8.84492C14.082 8.98554 14.6599 9.23955 15.0889 9.5906C15.5175 9.94134 15.8337 10.4235 15.8337 11C15.8337 11.5765 15.5175 12.0586 15.0889 12.4094C14.6599 12.7604 14.082 13.0144 13.4408 13.155C13.171 13.2142 12.9044 13.0435 12.8453 12.7737C12.7861 12.504 12.9568 12.2374 13.2266 12.1783C13.7548 12.0624 14.177 11.8634 14.4556 11.6354C14.7346 11.4071 14.8337 11.1842 14.8337 11C14.8337 10.8158 14.7346 10.5928 14.4556 10.3645C14.177 10.1365 13.7548 9.93755 13.2266 9.82171C12.9568 9.76256 12.7861 9.49594 12.8453 9.22621Z" fill="#858585" />
                    <path d="M2.55989 8.84492C2.82962 8.78577 3.09624 8.95648 3.15539 9.22621C3.21454 9.49594 3.04383 9.76256 2.77409 9.82171C2.24585 9.93755 1.82369 10.1365 1.54507 10.3645C1.26608 10.5928 1.16699 10.8158 1.16699 11C1.16699 11.1842 1.26608 11.4071 1.54507 11.6354C1.82369 11.8634 2.24585 12.0624 2.77409 12.1783C3.04383 12.2374 3.21454 12.504 3.15539 12.7737C3.09624 13.0435 2.82962 13.2142 2.55989 13.155C1.91863 13.0144 1.34079 12.7604 0.911787 12.4094C0.483158 12.0586 0.166992 11.5765 0.166992 11C0.166992 10.4235 0.483158 9.94134 0.911787 9.5906C1.34079 9.23955 1.91863 8.98554 2.55989 8.84492Z" fill="#858585" />
                  </svg>

                </span>
                <span>مدیریت کاربران</span>
                <svg className={`submenu-arrow ${userManagementOpen ? 'open' : ''}`} width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M2.95363 5.98434C3.13334 5.77467 3.44899 5.75039 3.65866 5.9301L7.99993 9.65119L12.3412 5.9301C12.5509 5.75039 12.8665 5.77467 13.0462 5.98434C13.2259 6.194 13.2017 6.50965 12.992 6.68936L8.32532 10.6894C8.13808 10.8499 7.86178 10.8499 7.67453 10.6894L3.00787 6.68936C2.7982 6.50965 2.77392 6.194 2.95363 5.98434Z" fill="#858585" />
                </svg>
              </div>

              {userManagementOpen && (
                <div className="submenu-items">
                  <div className="submenu-item">
                    <div className="submenu-branch"></div>
                    <span>مدیریت نقش ها</span>
                  </div>
                  <div className="submenu-item">
                    <div className="submenu-branch"></div>
                    <span>دسترسی نقش ها به کاربران</span>
                  </div>
                </div>
              )}
            </div>

            <div
              className={`menu-item ${activeMenu === 'facmanage' ? 'active' : ''}`}
              onClick={() => handleMenuClick('facmanage', 'مدیریت امکانات')}
            >
              <span className="menu-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.03259 0.833375H7.96676C7.52353 0.833351 7.1416 0.833331 6.83578 0.874448C6.50802 0.918514 6.19385 1.01789 5.93901 1.27272C5.68418 1.52755 5.58481 1.84172 5.54074 2.16948C5.49963 2.47531 5.49965 2.85722 5.49967 3.30046L5.49967 4.91873C5.34329 4.86346 5.17499 4.83338 4.99967 4.83338H2.99967C2.17125 4.83338 1.49967 5.50495 1.49967 6.33338V14.1667H1.33301C1.05687 14.1667 0.833008 14.3906 0.833008 14.6667C0.833008 14.9429 1.05687 15.1667 1.33301 15.1667H14.6663C14.9425 15.1667 15.1663 14.9429 15.1663 14.6667C15.1663 14.3906 14.9425 14.1667 14.6663 14.1667H14.4997V9.66671C14.4997 8.83828 13.8281 8.16671 12.9997 8.16671H10.9997C10.8244 8.16671 10.6561 8.19679 10.4997 8.25206L10.4997 3.30047C10.4997 2.85722 10.4997 2.47531 10.4586 2.16948C10.4145 1.84172 10.3152 1.52755 10.0603 1.27272C9.8055 1.01789 9.49133 0.918514 9.16357 0.874448C8.85775 0.833331 8.47582 0.833351 8.03259 0.833375ZM13.4997 14.1667V9.66671C13.4997 9.39057 13.2758 9.16671 12.9997 9.16671H10.9997C10.7235 9.16671 10.4997 9.39057 10.4997 9.66671V14.1667H13.4997ZM9.49967 14.1667V3.33338C9.49967 2.84784 9.49861 2.53398 9.46752 2.30273C9.43836 2.08586 9.39129 2.01789 9.35323 1.97982C9.31517 1.94176 9.24719 1.89469 9.03032 1.86553C8.79907 1.83444 8.48521 1.83338 7.99967 1.83338C7.51413 1.83338 7.20028 1.83444 6.96903 1.86553C6.75216 1.89469 6.68418 1.94176 6.64612 1.97982C6.60806 2.01789 6.56099 2.08586 6.53183 2.30273C6.50074 2.53398 6.49967 2.84784 6.49967 3.33338V14.1667H9.49967ZM5.49967 14.1667V6.33338C5.49967 6.05724 5.27582 5.83338 4.99967 5.83338H2.99967C2.72353 5.83338 2.49967 6.05724 2.49967 6.33338V14.1667H5.49967Z" fill="#858585" />
                </svg>


              </span>
              <span>مدیریت امکانات</span>
              <svg className="submenu-arrow" width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M2.95363 5.98434C3.13334 5.77467 3.44899 5.75039 3.65866 5.9301L7.99993 9.65119L12.3412 5.9301C12.5509 5.75039 12.8665 5.77467 13.0462 5.98434C13.2259 6.194 13.2017 6.50965 12.992 6.68936L8.32532 10.6894C8.13808 10.8499 7.86178 10.8499 7.67453 10.6894L3.00787 6.68936C2.7982 6.50965 2.77392 6.194 2.95363 5.98434Z" fill="#858585" />
              </svg>
            </div>

            <div className="menu-item with-submenu">
              <div
                className={`menu-item ${activeMenu === 'culturemanage' ? 'active' : ''}`}
                onClick={() => {
                  toggleUserCulture();
                  handleMenuClick('culturemanage', 'مدیریت اطلاهات فرهنگی');
                }}
              >
                <span className="menu-icon">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.03259 0.833375H7.96676C7.52353 0.833351 7.1416 0.833331 6.83578 0.874448C6.50802 0.918514 6.19385 1.01789 5.93901 1.27272C5.68418 1.52755 5.58481 1.84172 5.54074 2.16948C5.49963 2.47531 5.49965 2.85722 5.49967 3.30046L5.49967 4.91873C5.34329 4.86346 5.17499 4.83338 4.99967 4.83338H2.99967C2.17125 4.83338 1.49967 5.50495 1.49967 6.33338V14.1667H1.33301C1.05687 14.1667 0.833008 14.3906 0.833008 14.6667C0.833008 14.9429 1.05687 15.1667 1.33301 15.1667H14.6663C14.9425 15.1667 15.1663 14.9429 15.1663 14.6667C15.1663 14.3906 14.9425 14.1667 14.6663 14.1667H14.4997V9.66671C14.4997 8.83828 13.8281 8.16671 12.9997 8.16671H10.9997C10.8244 8.16671 10.6561 8.19679 10.4997 8.25206L10.4997 3.30047C10.4997 2.85722 10.4997 2.47531 10.4586 2.16948C10.4145 1.84172 10.3152 1.52755 10.0603 1.27272C9.8055 1.01789 9.49133 0.918514 9.16357 0.874448C8.85775 0.833331 8.47582 0.833351 8.03259 0.833375ZM13.4997 14.1667V9.66671C13.4997 9.39057 13.2758 9.16671 12.9997 9.16671H10.9997C10.7235 9.16671 10.4997 9.39057 10.4997 9.66671V14.1667H13.4997ZM9.49967 14.1667V3.33338C9.49967 2.84784 9.49861 2.53398 9.46752 2.30273C9.43836 2.08586 9.39129 2.01789 9.35323 1.97982C9.31517 1.94176 9.24719 1.89469 9.03032 1.86553C8.79907 1.83444 8.48521 1.83338 7.99967 1.83338C7.51413 1.83338 7.20028 1.83444 6.96903 1.86553C6.75216 1.89469 6.68418 1.94176 6.64612 1.97982C6.60806 2.01789 6.56099 2.08586 6.53183 2.30273C6.50074 2.53398 6.49967 2.84784 6.49967 3.33338V14.1667H9.49967ZM5.49967 14.1667V6.33338C5.49967 6.05724 5.27582 5.83338 4.99967 5.83338H2.99967C2.72353 5.83338 2.49967 6.05724 2.49967 6.33338V14.1667H5.49967Z" fill="#858585" />
                  </svg>

                </span>
                <span>مدیریت اطلاعات فرهنگی</span>
                <svg className={`submenu-arrow ${userCultureOpen ? 'open' : ''}`} width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M2.95363 5.98434C3.13334 5.77467 3.44899 5.75039 3.65866 5.9301L7.99993 9.65119L12.3412 5.9301C12.5509 5.75039 12.8665 5.77467 13.0462 5.98434C13.2259 6.194 13.2017 6.50965 12.992 6.68936L8.32532 10.6894C8.13808 10.8499 7.86178 10.8499 7.67453 10.6894L3.00787 6.68936C2.7982 6.50965 2.77392 6.194 2.95363 5.98434Z" fill="#858585" />
                </svg>
              </div>

              {userCultureOpen && (
                <div className="submenu-items">
                  <div
                    className={`submenu-item ${currentReportView === 'بارگذاری و ثبت محتوا' ? 'active' : ''}`}
                    onClick={() => handleSubmenuClick('بارگذاری و ثبت محتوا')}
                  >
                    <div className="submenu-branch"></div>
                    <span>بارگذاری و ثبت محتوا</span>
                  </div>
                  <div className="submenu-item">
                    <div className="submenu-branch"></div>
                    <span>ثبت ماهیت</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sidebar-footer">

            <span className="menu-title3"> حساب کاربری  </span>

            <div className="menu-item">
              <span className="menu-icon"><svg width="17" height="16" viewBox="0 0 17 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.99245 10.7857C7.45342 10.7857 6.20435 9.53661 6.20435 7.99758C6.20435 6.45854 7.45342 5.20947 8.99245 5.20947C10.5315 5.20947 11.7806 6.45854 11.7806 7.99758C11.7806 9.53661 10.5315 10.7857 8.99245 10.7857ZM8.99245 6.32471C8.07052 6.32471 7.31959 7.07564 7.31959 7.99758C7.31959 8.91951 8.07052 9.67044 8.99245 9.67044C9.91438 9.67044 10.6653 8.91951 10.6653 7.99758C10.6653 7.07564 9.91438 6.32471 8.99245 6.32471Z" fill="#858585" stroke="#858585" strokeWidth="0.2" />
                <path d="M11.3792 15.5739C11.223 15.5739 11.0669 15.5516 10.9108 15.5144C10.4498 15.388 10.0632 15.098 9.81784 14.6891L9.72862 14.5404C9.28996 13.782 8.68773 13.782 8.24907 14.5404L8.16729 14.6817C7.92193 15.098 7.53532 15.3954 7.07435 15.5144C6.60595 15.6408 6.12268 15.5739 5.71375 15.3285L4.43494 14.5925C4.21024 14.4637 4.01313 14.2919 3.85487 14.0869C3.69662 13.8819 3.58033 13.6478 3.51266 13.3978C3.44499 13.1478 3.42726 12.8869 3.46049 12.6301C3.49372 12.3733 3.57725 12.1255 3.70632 11.901C3.92193 11.5218 3.98141 11.1798 3.85502 10.9642C3.72862 10.7486 3.40892 10.6222 2.97026 10.6222C1.88476 10.6222 1 9.73743 1 8.65193V7.34338C1 6.25788 1.88476 5.37312 2.97026 5.37312C3.40892 5.37312 3.72862 5.24673 3.85502 5.03112C3.98141 4.8155 3.92937 4.47349 3.70632 4.09431C3.4461 3.64078 3.37918 3.10546 3.51301 2.59989C3.64684 2.08688 3.97398 1.66309 4.43494 1.40286L5.72119 0.666803C6.56134 0.168662 7.66914 0.458625 8.17472 1.31364L8.26394 1.46234C8.7026 2.22071 9.30483 2.22071 9.74349 1.46234L9.82528 1.32108C10.3309 0.458625 11.4387 0.168662 12.2862 0.674238L13.5651 1.4103C13.7898 1.53905 13.9869 1.71083 14.1451 1.91582C14.3034 2.12081 14.4197 2.35499 14.4873 2.60497C14.555 2.85494 14.5727 3.11581 14.5395 3.37264C14.5063 3.62947 14.4227 3.87723 14.2937 4.10175C14.0781 4.48093 14.0186 4.82294 14.145 5.03855C14.2714 5.25416 14.5911 5.38056 15.0297 5.38056C16.1152 5.38056 17 6.26532 17 7.35082V8.65937C17 9.74487 16.1152 10.6296 15.0297 10.6296C14.5911 10.6296 14.2714 10.756 14.145 10.9716C14.0186 11.1872 14.0706 11.5293 14.2937 11.9084C14.5539 12.362 14.6283 12.8973 14.487 13.4029C14.4224 13.6544 14.3073 13.8902 14.1488 14.096C13.9904 14.3017 13.7918 14.4732 13.5651 14.5999L12.2788 15.3359C11.9963 15.4921 11.6914 15.5739 11.3792 15.5739ZM8.99256 12.8229C9.65427 12.8229 10.2714 13.2393 10.6952 13.9754L10.777 14.1166C10.8662 14.2727 11.0149 14.3843 11.1933 14.4289C11.3717 14.4735 11.5502 14.4512 11.6989 14.362L12.9851 13.6185C13.1814 13.5052 13.3251 13.3191 13.385 13.1006C13.4448 12.882 13.416 12.6486 13.3048 12.4512C12.881 11.7226 12.829 10.9716 13.1561 10.3991C13.4833 9.82665 14.1599 9.49952 15.0074 9.49952C15.4833 9.49952 15.8625 9.12033 15.8625 8.6445V7.33595C15.8625 6.86755 15.4833 6.48093 15.0074 6.48093C14.1599 6.48093 13.4833 6.15379 13.1561 5.5813C12.829 5.00881 12.881 4.25788 13.3048 3.52926C13.4164 3.33595 13.4461 3.10546 13.3866 2.88242C13.3271 2.65937 13.1859 2.48093 12.9926 2.36197L11.7063 1.62591C11.6287 1.58041 11.5429 1.55066 11.4538 1.53837C11.3647 1.52608 11.274 1.53148 11.187 1.55427C11.1 1.57706 11.0183 1.61679 10.9467 1.67118C10.8751 1.72558 10.8148 1.79357 10.7695 1.87126L10.6877 2.01253C10.2639 2.74859 9.64684 3.16494 8.98513 3.16494C8.32342 3.16494 7.70632 2.74859 7.28253 2.01253L7.20074 1.86383C7.10835 1.71188 6.9603 1.602 6.78811 1.55756C6.61592 1.51313 6.43319 1.53765 6.27881 1.62591L4.99256 2.36941C4.79627 2.48264 4.65258 2.66875 4.59271 2.88732C4.53285 3.10588 4.56165 3.33924 4.67286 3.53669C5.09665 4.26532 5.1487 5.01625 4.82156 5.58874C4.49442 6.16123 3.81784 6.48836 2.97026 6.48836C2.49442 6.48836 2.11524 6.86755 2.11524 7.34338V8.65193C2.11524 9.12033 2.49442 9.50695 2.97026 9.50695C3.81784 9.50695 4.49442 9.83409 4.82156 10.4066C5.1487 10.9791 5.09665 11.73 4.67286 12.4586C4.56134 12.6519 4.5316 12.8824 4.59108 13.1055C4.65056 13.3285 4.79182 13.507 4.98513 13.6259L6.27138 14.362C6.42751 14.4586 6.61338 14.4809 6.78439 14.4363C6.96282 14.3917 7.11152 14.2727 7.20818 14.1166L7.28996 13.9754C7.71375 13.2467 8.33085 12.8229 8.99256 12.8229Z" fill="#858585" stroke="#858585" strokeWidth="0.2" />
              </svg>
              </span>
              <span>تنظیمات</span>
            </div>
            <div className="menu-item">
              <span className="menu-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_167_1041)">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.16634 10.6667C6.16634 9.65419 6.98715 8.83337 7.99968 8.83337C9.0122 8.83337 9.83301 9.65419 9.83301 10.6667C9.83301 11.6792 9.0122 12.5 7.99968 12.5C6.98715 12.5 6.16634 11.6792 6.16634 10.6667ZM7.99968 9.83337C7.53944 9.83337 7.16634 10.2065 7.16634 10.6667C7.16634 11.1269 7.53944 11.5 7.99968 11.5C8.45991 11.5 8.83301 11.1269 8.83301 10.6667C8.83301 10.2065 8.45991 9.83337 7.99968 9.83337Z" fill="#858585" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.49968 6.20189V5.33337C3.49968 2.84809 5.51439 0.833374 7.99968 0.833374C10.485 0.833374 12.4997 2.84809 12.4997 5.33337V6.20189C12.6509 6.21252 12.7934 6.22636 12.9275 6.24439C13.5276 6.32507 14.0328 6.49766 14.4341 6.89894C14.8354 7.30022 15.008 7.80547 15.0887 8.40554C15.1664 8.98352 15.1664 9.7184 15.1663 10.6301V10.7033C15.1664 11.615 15.1664 12.3499 15.0887 12.9279C15.008 13.5279 14.8354 14.0332 14.4341 14.4345C14.0328 14.8358 13.5276 15.0083 12.9275 15.089C12.3495 15.1667 11.6147 15.1667 10.7029 15.1667H5.29643C4.3847 15.1667 3.64982 15.1667 3.07184 15.089C2.47177 15.0083 1.96652 14.8358 1.56524 14.4345C1.16396 14.0332 0.991368 13.5279 0.910691 12.9279C0.832984 12.3499 0.832995 11.615 0.833008 10.7033V10.6301C0.832995 9.7184 0.832984 8.98352 0.910691 8.40554C0.991368 7.80547 1.16396 7.30022 1.56524 6.89894C1.96652 6.49766 2.47177 6.32507 3.07184 6.24439C3.20593 6.22636 3.34845 6.21252 3.49968 6.20189ZM4.49968 5.33337C4.49968 3.40038 6.06668 1.83337 7.99968 1.83337C9.93267 1.83337 11.4997 3.40038 11.4997 5.33337V6.169C11.2507 6.1667 10.9853 6.1667 10.7029 6.16671H5.29643C5.01408 6.1667 4.74869 6.1667 4.49968 6.169V5.33337ZM3.20509 7.23547C2.71591 7.30124 2.45686 7.42154 2.27235 7.60605C2.08784 7.79056 1.96754 8.0496 1.90177 8.53879C1.83407 9.04235 1.83301 9.70976 1.83301 10.6667C1.83301 11.6237 1.83407 12.2911 1.90177 12.7946C1.96754 13.2838 2.08784 13.5429 2.27235 13.7274C2.45686 13.9119 2.71591 14.0322 3.20509 14.0979C3.70866 14.1656 4.37606 14.1667 5.33301 14.1667H10.6663C11.6233 14.1667 12.2907 14.1656 12.7943 14.0979C13.2834 14.0322 13.5425 13.9119 13.727 13.7274C13.9115 13.5429 14.0318 13.2838 14.0976 12.7946C14.1653 12.2911 14.1663 11.6237 14.1663 10.6667C14.1663 9.70976 14.1653 9.04235 14.0976 8.53879C14.0318 8.0496 13.9115 7.79056 13.727 7.60605C13.5425 7.42154 13.2834 7.30124 12.7943 7.23547C12.2907 7.16777 11.6233 7.16671 10.6663 7.16671H5.33301C4.37606 7.16671 3.70866 7.16777 3.20509 7.23547Z" fill="#858585" />
                </g>
                <defs>
                  <clipPath id="clip0_167_1041">
                    <rect width="16" height="16" fill="white" />
                  </clipPath>
                </defs>
              </svg>

              </span>
              <span>تغییر رمز عبور</span>
            </div>
            <div className="menu-item">
              <span className="menu-icon">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" clipRule="evenodd" d="M3.14513 2.06143C3.96259 1.2008 5.31473 1.36205 5.99046 2.31777L6.83112 3.50676C7.37161 4.2712 7.32595 5.33398 6.6809 6.0131L6.51767 6.18496C6.51721 6.18614 6.51673 6.18743 6.51624 6.18882C6.50761 6.21306 6.4858 6.29025 6.50727 6.43675C6.55176 6.74044 6.7862 7.35757 7.73797 8.3596C8.69274 9.36479 9.27185 9.6017 9.54021 9.64528C9.65599 9.66408 9.71654 9.64775 9.73585 9.64095L10.0083 9.35414C10.5908 8.74086 11.499 8.62004 12.2313 9.04155L13.505 9.77466C14.5936 10.4013 14.847 11.934 13.977 12.85L13.03 13.847C12.7344 14.1582 12.3314 14.4238 11.8333 14.473C10.6174 14.593 7.80066 14.4367 4.84774 11.3278C2.09229 8.42685 1.56884 5.90358 1.50267 4.67077L1.94674 4.64693L1.50267 4.67077C1.46998 4.06166 1.7415 3.53919 2.09873 3.16309L3.14513 2.06143ZM5.17393 2.89508C4.83237 2.41198 4.21874 2.38316 3.87019 2.75012L2.82379 3.85178C2.60286 4.08438 2.48694 4.35097 2.50123 4.61717C2.55526 5.62372 2.98871 7.91857 5.5728 10.6391C8.28225 13.4917 10.7784 13.5723 11.7351 13.4778C11.9243 13.4592 12.1189 13.3542 12.3049 13.1583L13.2519 12.1613C13.6605 11.7312 13.5534 10.9563 13.0061 10.6413L11.7325 9.90823C11.3907 9.7115 10.9903 9.77229 10.7333 10.0428L10.4297 10.3625L10.0782 10.0287C10.4297 10.3625 10.4292 10.363 10.4288 10.3635L10.4278 10.3645L10.4258 10.3665L10.4216 10.3708L10.4121 10.3802C10.4052 10.3869 10.3973 10.3942 10.3883 10.4021C10.3704 10.4178 10.3482 10.4357 10.3216 10.4546C10.2682 10.4925 10.197 10.5341 10.1071 10.5696C9.92307 10.6422 9.68009 10.6811 9.37991 10.6323C8.7949 10.5373 8.02815 10.1171 7.01291 9.04829C5.99468 7.97628 5.60497 7.17647 5.51783 6.58172C5.47348 6.27901 5.50897 6.03661 5.57411 5.85357C5.60614 5.76355 5.64396 5.69178 5.67884 5.63727C5.69623 5.61009 5.71281 5.58733 5.72747 5.56881C5.73479 5.55955 5.74164 5.55135 5.74788 5.54418L5.75676 5.53419L5.76083 5.52977L5.76277 5.5277L5.76371 5.5267C5.76417 5.52621 5.76463 5.52573 6.11907 5.86238L5.76463 5.52572L5.95584 5.32441C6.25287 5.0117 6.29602 4.48211 6.01459 4.08407L5.17393 2.89508Z" fill="#858585" />
                  <path d="M8.83933 1.25338C8.88346 0.98079 9.14116 0.795874 9.41375 0.840006C9.43062 0.843236 9.48491 0.853383 9.51336 0.859718C9.57024 0.872386 9.6496 0.891892 9.74853 0.920709C9.94639 0.978338 10.2228 1.07327 10.5545 1.22536C11.2187 1.52987 12.1026 2.06254 13.0198 2.97974C13.937 3.89694 14.4697 4.78081 14.7742 5.445C14.9263 5.77674 15.0212 6.05314 15.0788 6.251C15.1076 6.34993 15.1271 6.42929 15.1398 6.48617C15.1461 6.51462 15.1508 6.53746 15.154 6.55433L15.1578 6.57513C15.202 6.84772 15.0187 7.11607 14.7461 7.1602C14.4743 7.2042 14.2183 7.02018 14.1731 6.74887C14.1717 6.74158 14.1678 6.72201 14.1637 6.70355C14.1555 6.66663 14.1413 6.60808 14.1187 6.53065C14.0736 6.37575 13.9952 6.14553 13.8651 5.86175C13.6053 5.29488 13.1379 4.51209 12.3127 3.68684C11.4874 2.8616 10.7047 2.39427 10.1378 2.13439C9.854 2.00428 9.62378 1.92593 9.46888 1.88081C9.39145 1.85826 9.29412 1.83592 9.2572 1.82769C8.98588 1.78248 8.79533 1.5252 8.83933 1.25338Z" fill="#858585" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M8.99105 3.55308C9.06691 3.28756 9.34365 3.13381 9.60917 3.20967L9.47181 3.69044C9.60917 3.20967 9.6094 3.20974 9.60964 3.20981L9.61013 3.20995L9.61115 3.21024L9.61337 3.21089L9.61854 3.21244L9.63173 3.21655C9.64178 3.21976 9.65434 3.22395 9.6693 3.22926C9.69925 3.23988 9.73882 3.25499 9.78736 3.27579C9.88448 3.31742 10.0172 3.3817 10.1802 3.47817C10.5065 3.67129 10.952 3.99208 11.4753 4.51539C11.9986 5.03871 12.3194 5.48417 12.5125 5.81048C12.609 5.97348 12.6733 6.10619 12.7149 6.20332C12.7357 6.25185 12.7508 6.29143 12.7614 6.32137C12.7667 6.33633 12.7709 6.34889 12.7741 6.35894L12.7782 6.37213L12.7798 6.3773L12.7804 6.37952L12.7807 6.38054L12.7809 6.38103C12.7809 6.38127 12.781 6.3815 12.3002 6.51886L12.781 6.3815C12.8569 6.64702 12.7031 6.92376 12.4376 6.99963C12.1743 7.07484 11.9 6.92434 11.8214 6.66296L11.819 6.65578C11.8154 6.64576 11.8081 6.62604 11.7957 6.59724C11.7711 6.53968 11.7263 6.44552 11.6519 6.3198C11.5033 6.06864 11.2348 5.68914 10.7682 5.2225C10.3015 4.75587 9.92204 4.4874 9.67087 4.33875C9.54515 4.26434 9.45099 4.21961 9.39344 4.19494C9.36463 4.1826 9.34491 4.17524 9.33489 4.17169L9.32771 4.16922C9.06634 4.09064 8.91583 3.81634 8.99105 3.55308Z" fill="#858585" />
                </svg>


              </span>
              <span>پشتیبانی</span>
            </div>
            <div className="menu-item">
              <span className="menu-icon9">
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8.84615 1.44869C8.84615 1.11945 8.57925 0.852539 8.25 0.852539C7.92075 0.852539 7.65385 1.11945 7.65385 1.44869V4.62818C7.65385 4.95743 7.92075 5.22433 8.25 5.22433C8.57925 5.22433 8.84615 4.95743 8.84615 4.62818V1.44869Z" fill="#EA4335" />
                  <path d="M5.69997 3.35383C6.00326 3.22568 6.14524 2.87594 6.0171 2.57266C5.88896 2.26937 5.53922 2.12738 5.23593 2.25552C2.45405 3.43088 0.5 6.18526 0.5 9.39741C0.5 13.6776 3.96979 17.1474 8.25 17.1474C12.5302 17.1474 16 13.6776 16 9.39741C16 6.18526 14.0459 3.43088 11.2641 2.25552C10.9608 2.12738 10.611 2.26937 10.4829 2.57266C10.3548 2.87594 10.4967 3.22568 10.8 3.35383C13.1561 4.34928 14.8077 6.68116 14.8077 9.39741C14.8077 13.0191 11.8717 15.9551 8.25 15.9551C4.62829 15.9551 1.69231 13.0191 1.69231 9.39741C1.69231 6.68116 3.34389 4.34928 5.69997 3.35383Z" fill="#EA4335" />
                  <path d="M8.84615 1.44869C8.84615 1.11945 8.57925 0.852539 8.25 0.852539C7.92075 0.852539 7.65385 1.11945 7.65385 1.44869V4.62818C7.65385 4.95743 7.92075 5.22433 8.25 5.22433C8.57925 5.22433 8.84615 4.95743 8.84615 4.62818V1.44869Z" stroke="#EA4335" strokeWidth="0.2" strokeLinecap="round" />
                  <path d="M5.69997 3.35383C6.00326 3.22568 6.14524 2.87594 6.0171 2.57266C5.88896 2.26937 5.53922 2.12738 5.23593 2.25552C2.45405 3.43088 0.5 6.18526 0.5 9.39741C0.5 13.6776 3.96979 17.1474 8.25 17.1474C12.5302 17.1474 16 13.6776 16 9.39741C16 6.18526 14.0459 3.43088 11.2641 2.25552C10.9608 2.12738 10.611 2.26937 10.4829 2.57266C10.3548 2.87594 10.4967 3.22568 10.8 3.35383C13.1561 4.34928 14.8077 6.68116 14.8077 9.39741C14.8077 13.0191 11.8717 15.9551 8.25 15.9551C4.62829 15.9551 1.69231 13.0191 1.69231 9.39741C1.69231 6.68116 3.34389 4.34928 5.69997 3.35383Z" stroke="#EA4335" strokeWidth="0.2" strokeLinecap="round" />
                </svg>

              </span>
              <span className="menu-item-exit">خروج از حساب</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className={`admin-content ${isMapFullscreen ? 'fullscreen-map-content' : ''}`} ref={contentRef}>
          {/* Content Header */}
          <div className="content-header">
            <div className="breadcrumb-nav">
              {breadcrumbPath.map((item, index) => (
                <span key={index} className="breadcrumb-item">
                  {item}
                  {index < breadcrumbPath.length - 1 && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 12L6 8L10 4" stroke="#858585" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              ))}
            </div>
            <div className="header-content-wrapper">
              <div>
                <h1>{getPageTitle().title}</h1>
                <p>{getPageTitle().description}</p>
              </div>
              <div className="calendar-section">
                <div className="date-display">
                  {formatJalaliDate(selectedDate)}
                </div>
                <button className="calendar-btn"
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                >
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="20" fill="#F2F2F2" />
                    <path d="M17.1433 12.6388C17.2606 12.639 17.361 12.7402 17.361 12.8575V15.0001C17.361 15.1175 17.2606 15.2177 17.1433 15.2179C17.0258 15.2179 16.9246 15.1176 16.9245 15.0001V12.8575C16.9245 12.74 17.0257 12.6388 17.1433 12.6388Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.634921" />
                    <path d="M22.8576 12.6388C22.9749 12.639 23.0753 12.7402 23.0753 12.8575V15.0001C23.0753 15.1175 22.9749 15.2177 22.8576 15.2179C22.7401 15.2179 22.6389 15.1176 22.6388 15.0001V12.8575C22.6388 12.74 22.74 12.6388 22.8576 12.6388Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.634921" />
                    <path d="M17.5 21.7857C17.4071 21.7857 17.3143 21.7643 17.2286 21.7286C17.1357 21.6929 17.0643 21.6429 16.9929 21.5786C16.8643 21.4429 16.7857 21.2643 16.7857 21.0714C16.7857 20.9786 16.8071 20.8857 16.8429 20.8C16.8786 20.7143 16.9286 20.6357 16.9929 20.5643C17.0643 20.5 17.1357 20.45 17.2286 20.4143C17.4857 20.3071 17.8071 20.3643 18.0071 20.5643C18.1357 20.7 18.2143 20.8857 18.2143 21.0714C18.2143 21.1143 18.2071 21.1643 18.2 21.2143C18.1929 21.2572 18.1786 21.3 18.1571 21.3429C18.1429 21.3857 18.1214 21.4286 18.0929 21.4714C18.0714 21.5072 18.0357 21.5429 18.0071 21.5786C17.8714 21.7071 17.6857 21.7857 17.5 21.7857Z" fill="#1E2023" />
                    <path d="M20 21.7857C19.9071 21.7857 19.8143 21.7643 19.7286 21.7286C19.6357 21.6928 19.5643 21.6428 19.4929 21.5785C19.3643 21.4428 19.2857 21.2643 19.2857 21.0714C19.2857 20.9786 19.3071 20.8857 19.3429 20.8C19.3786 20.7143 19.4286 20.6357 19.4929 20.5643C19.5643 20.5 19.6357 20.45 19.7286 20.4143C19.9857 20.3 20.3071 20.3643 20.5071 20.5643C20.6357 20.7 20.7143 20.8857 20.7143 21.0714C20.7143 21.1143 20.7071 21.1643 20.7 21.2143C20.6929 21.2571 20.6786 21.3 20.6571 21.3428C20.6429 21.3857 20.6214 21.4285 20.5929 21.4714C20.5714 21.5071 20.5357 21.5428 20.5071 21.5785C20.3714 21.7071 20.1857 21.7857 20 21.7857Z" fill="#1E2023" />
                    <path d="M22.5 21.7857C22.4071 21.7857 22.3143 21.7643 22.2286 21.7286C22.1357 21.6928 22.0643 21.6428 21.9929 21.5785C21.9643 21.5428 21.9357 21.5071 21.9071 21.4714C21.8786 21.4285 21.8571 21.3857 21.8429 21.3428C21.8214 21.3 21.8071 21.2571 21.8 21.2143C21.7929 21.1643 21.7857 21.1143 21.7857 21.0714C21.7857 20.8857 21.8643 20.7 21.9929 20.5643C22.0643 20.5 22.1357 20.45 22.2286 20.4143C22.4929 20.3 22.8071 20.3643 23.0071 20.5643C23.1357 20.7 23.2143 20.8857 23.2143 21.0714C23.2143 21.1143 23.2071 21.1643 23.2 21.2143C23.1929 21.2571 23.1786 21.3 23.1571 21.3428C23.1429 21.3857 23.1214 21.4285 23.0929 21.4714C23.0714 21.5071 23.0357 21.5428 23.0071 21.5785C22.8714 21.7071 22.6857 21.7857 22.5 21.7857Z" fill="#1E2023" />
                    <path d="M17.5 24.2857C17.4071 24.2857 17.3143 24.2643 17.2286 24.2286C17.1429 24.1928 17.0643 24.1428 16.9929 24.0785C16.8643 23.4428 16.7857 23.7571 16.7857 23.5714C16.7857 23.4786 16.8071 23.3857 16.8429 23.3C16.8786 23.2071 16.9286 23.1286 16.9929 23.0643C17.2571 22.8 17.7429 22.8 18.0071 23.0643C18.1357 23.2 18.2143 23.3857 18.2143 23.5714C18.2143 23.7571 18.1357 23.9428 18.0071 24.0785C17.8714 24.2071 17.6857 24.2857 17.5 24.2857Z" fill="#1E2023" />
                    <path d="M20 24.2857C19.8143 24.2857 19.6286 24.2071 19.4929 24.0785C19.3643 23.9428 19.2857 23.7571 19.2857 23.5714C19.2857 23.4786 19.3071 23.3857 19.3429 23.3C19.3786 23.2071 19.4286 23.1286 19.4929 23.0643C19.7571 22.8 20.2429 22.8 20.5071 23.0643C20.5714 23.1286 20.6214 23.2071 20.6571 23.3C20.6929 23.3857 20.7143 23.4786 20.7143 23.5714C20.7143 23.7571 20.6357 23.9428 20.5071 24.0785C20.3714 24.2071 20.1857 24.2857 20 24.2857Z" fill="#1E2023" />
                    <path d="M22.5 24.2857C22.3143 24.2857 22.1286 24.2072 21.9929 24.0786C21.9286 24.0143 21.8786 23.9357 21.8429 23.8429C21.8071 23.7572 21.7857 23.6643 21.7857 23.5715C21.7857 23.4786 21.8071 23.3857 21.8429 23.3C21.8786 23.2072 21.9286 23.1286 21.9929 23.0643C22.1571 22.9 22.4071 22.8215 22.6357 22.8715C22.6857 22.8786 22.7286 22.8929 22.7714 22.9143C22.8143 22.9286 22.8571 22.95 22.9 22.9786C22.9357 23 22.9714 23.0357 23.0071 23.0643C23.1357 23.2 23.2143 23.3857 23.2143 23.5715C23.2143 23.7572 23.1357 23.9429 23.0071 24.0786C22.8714 24.2072 22.6857 24.2857 22.5 24.2857Z" fill="#1E2023" />
                    <path d="M26.0714 18.4571H13.9286C13.6357 18.4571 13.3929 18.2143 13.3929 17.9214C13.3929 17.6285 13.6357 17.3857 13.9286 17.3857H26.0714C26.3643 17.3857 26.6071 17.6285 26.6071 17.9214C26.6071 18.2143 26.3643 18.4571 26.0714 18.4571Z" fill="#1E2023" />
                    <path d="M22.8571 27.6786H17.1429C14.5357 27.6786 13.0357 26.1786 13.0357 23.5714V17.5C13.0357 14.8929 14.5357 13.3929 17.1429 13.3929H22.8571C25.4643 13.3929 26.9643 14.8929 26.9643 17.5V23.5714C26.9643 26.1786 25.4643 27.6786 22.8571 27.6786ZM17.1429 14.4643C15.1 14.4643 14.1071 15.4571 14.1071 17.5V23.5714C14.1071 25.6143 15.1 26.6071 17.1429 26.6071H22.8571C24.9 26.6071 25.8929 25.6143 25.8929 23.5714V17.5C25.8929 15.4571 24.9 14.4643 22.8571 14.4643H17.1429Z" fill="#1E2023" />
                  </svg>
                </button>

                {isCalendarOpen && (
                  <div className="calendar-popup" ref={calendarRef}>
                    <ReactDatePicker
                      selected={selectedDate}
                      onChange={(date) => {
                        setSelectedDate(date);
                        setIsCalendarOpen(false);
                      }}
                      inline
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      renderCustomHeader={({
                        date,
                        decreaseMonth,
                        increaseMonth,
                        prevMonthButtonDisabled,
                        nextMonthButtonDisabled,
                      }) => (
                        <div className="custom-header">
                          <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled}>
                            ‹
                          </button>
                          <span>
                            {date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long' })}
                          </span>
                          <button onClick={increaseMonth} disabled={nextMonthButtonDisabled}>
                            ›
                          </button>
                        </div>
                      )}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>



          {currentReportView === 'بارگذاری و ثبت محتوا' ? (
            /* Content Upload Section */
            <div className="content-upload-section">
              <div className="upload-header">
                <div className="search-existing">
                  <div className="search-box-with-icon">
                    <svg className="search-icon7" width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M10.4167 2.29166C14.4438 2.29166 17.7084 5.55625 17.7084 9.58332C17.7084 13.6104 14.4438 16.875 10.4167 16.875C6.38963 16.875 3.12504 13.6104 3.12504 9.58332C3.12504 5.55625 6.38963 2.29166 10.4167 2.29166ZM18.9584 9.58332C18.9584 4.86589 15.1341 1.04166 10.4167 1.04166C5.69928 1.04166 1.87504 4.86589 1.87504 9.58332C1.87504 11.7171 2.65743 13.6681 3.95099 15.1652L1.22476 17.8914C0.980688 18.1355 0.980688 18.5312 1.22476 18.7753C1.46884 19.0193 1.86457 19.0193 2.10865 18.7753L4.83487 16.049C6.33192 17.3426 8.28295 18.125 10.4167 18.125C15.1341 18.125 18.9584 14.3008 18.9584 9.58332Z" fill="#858585" />
                    </svg>
                    <input
                      type="text"
                      placeholder="جستجوی مکان موجود برای ویرایش..."
                      value={searchQuery}
                      onChange={handleSearchPlaces}
                      className="search-input7"
                    />
                  </div>
                  <button className="new-place-btn" onClick={resetForm}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8 3.33333V12.6667" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M3.33398 8H12.6673" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    مکان جدید
                  </button>
                </div>
              </div>

              <div className="upload-content">
                <div className="form-section">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">نام مکان *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={placeName}
                        onChange={(e) => setPlaceName(e.target.value)}
                        placeholder="نام مکان فرهنگی را وارد کنید"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">آدرس *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={placeAddress}
                        onChange={(e) => setPlaceAddress(e.target.value)}
                        placeholder="آدرس کامل مکان را وارد کنید"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">ساعت بازگشایی *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={openingTime}
                        onChange={(e) => setOpeningTime(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">ساعت بسته شدن *</label>
                      <input
                        type="time"
                        className="form-input"
                        value={closingTime}
                        onChange={(e) => setClosingTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">توضیح مختصر *</label>
                    <textarea
                      className="form-textarea short"
                      value={shortDescription}
                      onChange={(e) => setShortDescription(e.target.value)}
                      placeholder="توضیح کوتاه درباره مکان (حداکثر 200 کاراکتر)"
                      maxLength="200"
                    />
                    <div className="char-count">{shortDescription.length}/200</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">توضیح کامل *</label>
                    <textarea
                      className="form-textarea long"
                      value={fullDescription}
                      onChange={(e) => setFullDescription(e.target.value)}
                      placeholder="توضیح کامل درباره مکان، تاریخچه و ویژگی‌ها"
                      rows="4"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">آیکون مکان</label>
                    <div className="icon-upload-area">
                      {placeIcon ? (
                        <div className="icon-preview">
                          <img src={URL.createObjectURL(placeIcon)} alt="Place icon" />
                          <button
                            className="remove-icon"
                            onClick={() => setPlaceIcon(null)}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <label className="upload-placeholder">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleIconUpload}
                            className="file-input"
                          />
                          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 13.3333V26.6667" stroke="#858585" strokeWidth="2" strokeLinecap="round" />
                            <path d="M13.333 20H26.6663" stroke="#858585" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          <span>آیکون مکان را انتخاب کنید</span>
                          <small>فرمت‌های مجاز: JPG, PNG, SVG (حداکثر 2MB)</small>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">مدیا (عکس، فیلم، GIF)</label>
                    <div className="media-upload-area">
                      <label className="media-upload-btn">
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*,image/gif"
                          onChange={handleMediaUpload}
                          className="file-input"
                        />
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 4.16666V15.8333" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M4.16602 10H15.8327" stroke="#0F71EF" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        افزودن مدیا
                      </label>

                      {mediaFiles.length > 0 && (
                        <div className="media-preview">
                          {mediaFiles.map((file, index) => (
                            <div key={index} className="media-item">
                              {file.type.startsWith('image/') ? (
                                <img src={URL.createObjectURL(file)} alt={`Media ${index}`} />
                              ) : (
                                <video controls>
                                  <source src={URL.createObjectURL(file)} type={file.type} />
                                </video>
                              )}
                              <button
                                className="remove-media"
                                onClick={() => removeMediaFile(index)}
                              >
                                ×
                              </button>
                              <span className="file-name">{file.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">توضیحات تکمیلی (بایدها و نبایدها)</label>
                    <textarea
                      className="form-textarea"
                      value={additionalNotes}
                      onChange={(e) => setAdditionalNotes(e.target.value)}
                      placeholder="قوانین، بایدها و نبایدهای مکان (مانند: درآوردن کفش، پوشش مناسب و...)"
                      rows="3"
                    />
                  </div>

                  <div className="form-actions">
                    <button className="cancel-btn" onClick={resetForm}>
                      انصراف
                    </button>
                    <button className="save-btn" onClick={handleSavePlace}>
                      {isEditing ? 'بروزرسانی اطلاعات' : 'ثبت مکان جدید'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : currentReportView === 'کاربران ثبت نام کرده' ? (
            /* Registered Users Report View */
            <div className="reports-section">
              <div className="report-filters">
                <div className="filter-row">
                  {/* Date Filter */}
                  <div className="filter-group">
                    <label className="filter-label">انتخاب تاریخ</label>
                    <div className="date-input-with-separator">
                      <div className="dtg">
                        <span className="date-start">شروع</span>
                        <div className="date-separator"></div>
                        <span className="date-end">پایان</span>
                      </div>
                    </div>
                  </div>

                  {/* Gender Filter */}
                  <div className="filter-group">
                    <label className="filter-label">انتخاب جنسیت</label>
                    <div className="select-wrapper">
                      <select>
                        <option>همه</option>

                        <option>فقط مردان</option>
                        <option>فقط بانوان</option>
                      </select>
                    </div>
                  </div>

                  {/* Routing Success Filter */}
                  <div className="filter-group">
                    <label className="filter-label">مسیریابی موفق</label>
                    <div className="select-wrapper">
                      <select>
                        <option>همه</option>
                        <option>موفق</option>
                        <option>ناموفق</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="filter-actions">
                  <button className="clear-filters-btn">
                    پاک کردن فیلترها
                  </button>
                  <button className="export-report-btn">
                    <p>خروجی گزارشات</p>
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M3.69247 7.09327C3.91711 6.83119 4.31167 6.80084 4.57375 7.02548L10.0003 11.6768L15.4269 7.02548C15.689 6.80084 16.0836 6.83119 16.3082 7.09327C16.5328 7.35535 16.5025 7.74991 16.2404 7.97455L10.4071 12.9745C10.173 13.1752 9.82765 13.1752 9.59359 12.9745L3.76026 7.97455C3.49818 7.74991 3.46783 7.35535 3.69247 7.09327Z" fill="white" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : activeMenu === 'mapmanage' ? (
            /* Map Management Section */
            <div className="map-management-section">
              <div className="map-container">
                <div id="map-container" className="map-instance"></div>

                {/* Top Left - Map Type Selector */}
                <div className="map-control-top-left">
                  <div className="action-buttons-group">
                    <div className="action-button">
                      <span><svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M9.99935 1.04169C10.3445 1.04169 10.6243 1.32151 10.6243 1.66669V10.8105L12.0248 9.17661C12.2495 8.91453 12.644 8.88418 12.9061 9.10882C13.1682 9.33346 13.1985 9.72802 12.9739 9.9901L10.4739 12.9068C10.3551 13.0453 10.1818 13.125 9.99935 13.125C9.8169 13.125 9.64355 13.0453 9.52481 12.9068L7.02481 9.9901C6.80018 9.72802 6.83053 9.33346 7.09261 9.10882C7.35468 8.88418 7.74925 8.91453 7.97389 9.17661L9.37435 10.8105V1.66669C9.37435 1.32151 9.65417 1.04169 9.99935 1.04169ZM5.8292 6.87666C6.17438 6.87474 6.45575 7.153 6.45767 7.49817C6.4596 7.84334 6.18133 8.12472 5.83616 8.12664C4.92491 8.13171 4.27901 8.15538 3.78881 8.24542C3.31646 8.33218 3.04307 8.4715 2.84019 8.67437C2.60956 8.90501 2.45918 9.22882 2.37697 9.8403C2.29234 10.4698 2.29102 11.304 2.29102 12.5002V13.3335C2.29102 14.5297 2.29234 15.364 2.37697 15.9934C2.45918 16.6049 2.60956 16.9287 2.84019 17.1594C3.07083 17.39 3.39464 17.5404 4.00612 17.6226C4.63558 17.7072 5.46984 17.7085 6.66602 17.7085H13.3327C14.5289 17.7085 15.3631 17.7072 15.9926 17.6226C16.6041 17.5404 16.9279 17.39 17.1585 17.1594C17.3891 16.9287 17.5395 16.6049 17.6217 15.9934C17.7064 15.364 17.7077 14.5297 17.7077 13.3335V12.5002C17.7077 11.304 17.7064 10.4698 17.6217 9.8403C17.5395 9.22882 17.3891 8.90501 17.1585 8.67438C16.9556 8.4715 16.6822 8.33218 16.2099 8.24542C15.7197 8.15538 15.0738 8.13171 14.1625 8.12664C13.8174 8.12472 13.5391 7.84334 13.541 7.49817C13.5429 7.153 13.8243 6.87474 14.1695 6.87666C15.0708 6.88167 15.8219 6.90324 16.4357 7.01599C17.0674 7.13202 17.6049 7.35305 18.0424 7.79049C18.544 8.29209 18.7597 8.92365 18.8606 9.67374C18.9577 10.3962 18.9577 11.3148 18.9577 12.4545V13.3793C18.9577 14.5189 18.9577 15.4375 18.8606 16.16C18.7597 16.9101 18.544 17.5416 18.0424 18.0432C17.5408 18.5448 16.9092 18.7606 16.1591 18.8614C15.4367 18.9586 14.5181 18.9586 13.3784 18.9585H6.62029C5.48063 18.9586 4.56203 18.9586 3.83956 18.8614C3.08947 18.7606 2.4579 18.5448 1.95631 18.0432C1.45471 17.5416 1.23897 16.9101 1.13812 16.16C1.04099 15.4375 1.041 14.5189 1.04102 13.3793V12.4545C1.041 11.3148 1.04099 10.3962 1.13812 9.67374C1.23897 8.92365 1.45471 8.29209 1.95631 7.79049C2.39375 7.35305 2.93131 7.13202 3.56298 7.01599C4.17678 6.90324 4.92793 6.88167 5.8292 6.87666Z" fill="#1E2023" />
                      </svg>
                      </span>
                    </div>
                    <div className="date-separator3"></div>
                    <div className="action-button">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M9.99935 1.04169C10.1818 1.04169 10.3551 1.12141 10.4739 1.25994L12.9739 4.17661C13.1985 4.43869 13.1682 4.83325 12.9061 5.05789C12.644 5.28253 12.2495 5.25218 12.0248 4.9901L10.6244 3.35622L10.6243 12.5C10.6243 12.8452 10.3445 13.125 9.99935 13.125C9.65417 13.125 9.37435 12.8452 9.37435 12.5L9.37435 3.35622L7.97389 4.9901C7.74925 5.25218 7.35468 5.28253 7.09261 5.05789C6.83053 4.83325 6.80018 4.43869 7.02481 4.17661L9.52481 1.25994C9.64355 1.12141 9.8169 1.04169 9.99935 1.04169ZM5.8292 6.87666C6.17438 6.87474 6.45575 7.153 6.45767 7.49817C6.4596 7.84334 6.18133 8.12472 5.83616 8.12664C4.92491 8.13171 4.27901 8.15538 3.78881 8.24542C3.31646 8.33218 3.04307 8.4715 2.84019 8.67437C2.60956 8.90501 2.45918 9.22882 2.37697 9.8403C2.29234 10.4698 2.29102 11.304 2.29102 12.5002V13.3335C2.29102 14.5297 2.29234 15.364 2.37697 15.9934C2.45918 16.6049 2.60956 16.9287 2.84019 17.1594C3.07083 17.39 3.39464 17.5404 4.00612 17.6226C4.63558 17.7072 5.46984 17.7085 6.66602 17.7085H13.3327C14.5289 17.7085 15.3631 17.7072 15.9926 17.6226C16.6041 17.5404 16.9279 17.39 17.1585 17.1594C17.3891 16.9287 17.5395 16.6049 17.6217 15.9934C17.7064 15.364 17.7077 14.5297 17.7077 13.3335V12.5002C17.7077 11.304 17.7064 10.4698 17.6217 9.8403C17.5395 9.22882 17.3891 8.90501 17.1585 8.67437C16.9556 8.4715 16.6822 8.33218 16.2099 8.24542C15.7197 8.15538 15.0738 8.13171 14.1625 8.12664C13.8174 8.12472 13.5391 7.84334 13.541 7.49817C13.5429 7.153 13.8243 6.87474 14.1695 6.87666C15.0708 6.88167 15.8219 6.90324 16.4357 7.01599C17.0674 7.13202 17.6049 7.35305 18.0424 7.79049C18.544 8.29209 18.7597 8.92365 18.8606 9.67374C18.9577 10.3962 18.9577 11.3148 18.9577 12.4545V13.3793C18.9577 14.5189 18.9577 15.4375 18.8606 16.16C18.7597 16.9101 18.544 17.5416 18.0424 18.0432C17.5408 18.5448 16.9092 18.7606 16.1591 18.8614C15.4367 18.9586 14.5181 18.9585 13.3784 18.9585H6.62029C5.48063 18.9585 4.56203 18.9586 3.83956 18.8614C3.08947 18.7606 2.4579 18.5448 1.95631 18.0432C1.45471 17.5416 1.23897 16.9101 1.13812 16.16C1.04099 15.4375 1.041 14.5189 1.04102 13.3793V12.4545C1.041 11.3148 1.04099 10.3962 1.13812 9.67374C1.23897 8.92365 1.45471 8.29209 1.95631 7.79049C2.39375 7.35305 2.93131 7.13202 3.56298 7.01599C4.17678 6.90324 4.92793 6.88167 5.8292 6.87666Z" fill="#1E2023" />
                      </svg>
                    </div>
                  </div>
                  <div className="action-buttons-group">
                    <div className="action-button">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M4.12685 1.875C4.13986 1.875 4.15292 1.875 4.16602 1.875L15.8719 1.875C16.4276 1.87498 16.9028 1.87495 17.2825 1.92285C17.6852 1.97365 18.0745 2.08775 18.3942 2.3877C18.7196 2.69295 18.8488 3.0738 18.9056 3.47004C18.9578 3.83404 18.9577 4.28664 18.9577 4.80299L18.9577 5.4501C18.9577 5.85719 18.9577 6.20912 18.9273 6.50259C18.8946 6.81839 18.8231 7.11466 18.6515 7.39911C18.4811 7.68142 18.2517 7.88633 17.9872 8.07003C17.7381 8.24308 17.4198 8.42225 17.0454 8.63296L14.5934 10.0133C14.0353 10.3275 13.8409 10.4406 13.7112 10.5533C13.4132 10.812 13.2425 11.099 13.1623 11.4587C13.1281 11.6124 13.1244 11.806 13.1244 12.3941L13.1244 14.6708C13.1244 15.4219 13.1244 16.0595 13.0471 16.5496C12.965 17.0709 12.7742 17.5708 12.2742 17.8835C11.7855 18.1892 11.2473 18.1611 10.7242 18.0369C10.2204 17.9172 9.59957 17.6745 8.85465 17.3833L8.78225 17.355C8.43331 17.2186 8.12777 17.0991 7.88589 16.9743C7.62593 16.84 7.38451 16.673 7.19981 16.4131C7.01303 16.1502 6.93814 15.8684 6.90475 15.5803C6.8743 15.3175 6.87432 15.0022 6.87435 14.6505L6.87435 12.3941C6.87435 11.806 6.87064 11.6124 6.83636 11.4587C6.75618 11.099 6.58553 10.812 6.28755 10.5533C6.1578 10.4406 5.96345 10.3275 5.4053 10.0133L2.95327 8.63296C2.57892 8.42225 2.26063 8.24308 2.0115 8.07003C1.74705 7.88633 1.51761 7.68142 1.34724 7.39911C1.17559 7.11466 1.1041 6.81839 1.07139 6.50259C1.04099 6.20912 1.041 5.85719 1.04102 5.4501L1.04102 4.84555C1.04102 4.83131 1.04102 4.81712 1.04102 4.80297C1.04098 4.28663 1.04094 3.83403 1.0931 3.47004C1.14989 3.0738 1.27915 2.69295 1.6045 2.3877C1.92421 2.08775 2.31347 1.97365 2.71621 1.92285C3.09595 1.87495 3.57107 1.87498 4.12685 1.875ZM2.87265 3.16303C2.5946 3.1981 2.50618 3.25576 2.45977 3.2993C2.41901 3.33755 2.36521 3.40487 2.33046 3.64736C2.29252 3.91212 2.29102 4.2739 2.29102 4.84555V5.4204C2.29102 5.86558 2.29179 6.15231 2.31473 6.37379C2.3361 6.58005 2.37279 6.67923 2.41746 6.75326C2.46343 6.82943 2.53977 6.915 2.72463 7.04341C2.9194 7.1787 3.18548 7.32923 3.59096 7.55749L6.01848 8.92402C6.04121 8.93682 6.0636 8.94941 6.08566 8.96182C6.55124 9.22376 6.86833 9.40215 7.10701 9.60936C7.59981 10.0372 7.91599 10.5568 8.05641 11.1866C8.12465 11.4927 8.12454 11.8359 8.12437 12.3204C8.12436 12.3446 8.12435 12.3692 8.12435 12.3941V14.6187C8.12435 15.0121 8.12532 15.2542 8.14644 15.4364C8.16553 15.6011 8.19562 15.6565 8.21877 15.6891C8.244 15.7246 8.29399 15.7782 8.45938 15.8636C8.63639 15.955 8.88025 16.0512 9.26537 16.2017C10.0662 16.5148 10.6049 16.7238 11.013 16.8207C11.4119 16.9154 11.5433 16.8663 11.6113 16.8238C11.6679 16.7884 11.7554 16.7164 11.8124 16.355C11.8725 15.9738 11.8744 15.4362 11.8744 14.6187V12.3941C11.8744 12.3692 11.8743 12.3446 11.8743 12.3204C11.8742 11.8359 11.8741 11.4927 11.9423 11.1866C12.0827 10.5568 12.3989 10.0372 12.8917 9.60936C13.1304 9.40215 13.4474 9.22376 13.913 8.96184C13.9351 8.94942 13.9575 8.93682 13.9802 8.92402L16.4077 7.55749C16.8132 7.32923 17.0793 7.1787 17.2741 7.04341C17.4589 6.915 17.5353 6.82943 17.5812 6.75326C17.6259 6.67923 17.6626 6.58005 17.684 6.37379C17.7069 6.15231 17.7077 5.86558 17.7077 5.4204V4.84555C17.7077 4.2739 17.7062 3.91212 17.6682 3.64736C17.6335 3.40487 17.5797 3.33755 17.5389 3.2993C17.4925 3.25576 17.4041 3.1981 17.1261 3.16303C16.8339 3.12617 16.4385 3.125 15.8327 3.125H4.16602C3.56016 3.125 3.1648 3.12617 2.87265 3.16303Z" fill="#1E2023" />
                      </svg>
                    </div>
                    <div className="date-separator3"></div>
                    <div className="action-button">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M4.16602 1.04163C4.51119 1.04163 4.79102 1.32145 4.79102 1.66663V9.16663C4.79102 10.7556 4.79234 11.8845 4.90748 12.7409C5.0202 13.5793 5.23159 14.0624 5.58427 14.415C5.93694 14.7677 6.41998 14.9791 7.25839 15.0918C8.11478 15.207 9.24367 15.2083 10.8327 15.2083H18.3327C18.6779 15.2083 18.9577 15.4881 18.9577 15.8333C18.9577 16.1785 18.6779 16.4583 18.3327 16.4583H16.4577V18.3333C16.4577 18.6785 16.1779 18.9583 15.8327 18.9583C15.4875 18.9583 15.2077 18.6785 15.2077 18.3333V16.4583H10.7857C9.25421 16.4583 8.04118 16.4583 7.09183 16.3307C6.11481 16.1993 5.32402 15.9226 4.70038 15.2989C4.07675 14.6753 3.79998 13.8845 3.66863 12.9075C3.54099 11.9581 3.541 10.7451 3.54102 9.21364L3.54102 4.79163H1.66602C1.32084 4.79163 1.04102 4.5118 1.04102 4.16663C1.04102 3.82145 1.32084 3.54163 1.66602 3.54163H3.54102V1.66663C3.54102 1.32145 3.82084 1.04163 4.16602 1.04163ZM12.7403 4.90809C11.8839 4.79295 10.755 4.79163 9.16602 4.79163H6.66602C6.32084 4.79163 6.04102 4.5118 6.04102 4.16663C6.04102 3.82145 6.32084 3.54163 6.66602 3.54163L9.21303 3.54163C10.7445 3.54161 11.9575 3.5416 12.9069 3.66924C13.8839 3.80059 14.6747 4.07736 15.2983 4.701C15.922 5.32463 16.1987 6.11542 16.3301 7.09244C16.4577 8.04179 16.4577 9.25482 16.4577 10.7863V13.3333C16.4577 13.6785 16.1779 13.9583 15.8327 13.9583C15.4875 13.9583 15.2077 13.6785 15.2077 13.3333V10.8333C15.2077 9.24428 15.2064 8.11539 15.0912 7.259C14.9785 6.42059 14.7671 5.93755 14.4144 5.58488C14.0618 5.2322 13.5787 5.02081 12.7403 4.90809Z" fill="#1E2023" />
                      </svg>
                    </div>
                    <div className="date-separator3"></div>
                    <div className="action-button">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M5.00065 3.125C4.42535 3.125 3.95898 3.59137 3.95898 4.16667C3.95898 4.74196 4.42535 5.20833 5.00065 5.20833C5.57595 5.20833 6.04232 4.74196 6.04232 4.16667C6.04232 3.59137 5.57595 3.125 5.00065 3.125ZM2.70898 4.16667C2.70898 2.90101 3.735 1.875 5.00065 1.875C6.04963 1.875 6.934 2.57979 7.20605 3.54167H13.7507C15.7067 3.54167 17.2923 5.12733 17.2923 7.08333C17.2923 9.03934 15.7067 10.625 13.7507 10.625H6.25065C4.985 10.625 3.95898 11.651 3.95898 12.9167C3.95898 14.1823 4.985 15.2083 6.25065 15.2083H15.1584L14.5587 14.6086C14.3146 14.3645 14.3146 13.9688 14.5587 13.7247C14.8028 13.4806 15.1985 13.4806 15.4426 13.7247L17.1093 15.3914C17.3533 15.6355 17.3533 16.0312 17.1093 16.2753L15.4426 17.9419C15.1985 18.186 14.8028 18.186 14.5587 17.9419C14.3146 17.6979 14.3146 17.3021 14.5587 17.0581L15.1584 16.4583H6.25065C4.29464 16.4583 2.70898 14.8727 2.70898 12.9167C2.70898 10.9607 4.29464 9.375 6.25065 9.375H13.7507C15.0163 9.375 16.0423 8.34899 16.0423 7.08333C16.0423 5.81768 15.0163 4.79167 13.7507 4.79167H7.20605C6.934 5.75354 6.04963 6.45833 5.00065 6.45833C3.735 6.45833 2.70898 5.43232 2.70898 4.16667Z" fill="#1E2023" />
                      </svg>
                    </div>
                    <div className="date-separator3"></div>
                    <div
                      className={`action-button ${isLocationMarkerMode ? 'selected' : ''}`}
                      onClick={handleLocationMarkerSelect}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M2.70898 8.4527C2.70898 4.37019 5.96316 1.04163 10.0007 1.04163C14.0381 1.04163 17.2923 4.37019 17.2923 8.4527C17.2923 10.4236 16.7306 12.5399 15.7377 14.3682C14.746 16.1942 13.297 17.781 11.4844 18.6282C10.5428 19.0683 9.45851 19.0683 8.51689 18.6282C6.70429 17.781 5.25533 16.1942 4.26361 14.3682C3.27067 12.5399 2.70898 10.4236 2.70898 8.4527ZM10.0007 2.29163C6.67435 2.29163 3.95898 5.03953 3.95898 8.4527C3.95898 10.2003 4.46118 12.1128 5.36207 13.7716C6.26418 15.4327 7.539 16.7913 9.04619 17.4958C9.65236 17.7791 10.3489 17.7791 10.9551 17.4958C12.4623 16.7913 13.7371 15.4327 14.6392 13.7716C15.5401 12.1128 16.0423 10.2003 16.0423 8.4527C16.0423 5.03953 13.327 2.29163 10.0007 2.29163ZM10.0007 5.62496C10.3458 5.62496 10.6257 5.90478 10.6257 6.24996V7.70829H12.084C12.4292 7.70829 12.709 7.98811 12.709 8.33329C12.709 8.67847 12.4292 8.95829 12.084 8.95829H10.6257V10.4166C10.6257 10.7618 10.3458 11.0416 10.0007 11.0416C9.65547 11.0416 9.37565 10.7618 9.37565 10.4166V8.95829H7.91732C7.57214 8.95829 7.29232 8.67847 7.29232 8.33329C7.29232 7.98811 7.57214 7.70829 7.91732 7.70829H9.37565V6.24996C9.37565 5.90478 9.65547 5.62496 10.0007 5.62496Z" fill={isLocationMarkerMode ? "white" : "#1E2023"} />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Top Right - Action Buttons */}
                <div className="map-control-top-right">

                  {isMapFullscreen && (
                    <button className="exit-fullscreen-btn" onClick={handleExitFullscreenMap}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M13.4697 5.46967C13.7626 5.17678 14.2374 5.17678 14.5303 5.46967L20.5303 11.4697C20.8232 11.7626 20.8232 12.2374 20.5303 12.5303L14.5303 18.5303C14.2374 18.8232 13.7626 18.8232 13.4697 18.5303C13.1768 18.2374 13.1768 17.7626 13.4697 17.4697L18.1893 12.75H4C3.58579 12.75 3.25 12.4142 3.25 12C3.25 11.5858 3.58579 11.25 4 11.25H18.1893L13.4697 6.53033C13.1768 6.23744 13.1768 5.76256 13.4697 5.46967Z" fill="white" />
                      </svg>
                      بازگشت و کوچک‌نمایی نقشه
                    </button>
                  )}
                  <div className="map-type-selector">
                    <div className="map-type-display" onClick={() => setIsMapTypeOpen(!isMapTypeOpen)}>
                      <span className="stgi">نوع نقشه
                        <div className="date-separator2"></div>
                      </span>
                      <span>{mapType}</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path fillRule="evenodd" clipRule="evenodd" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" fill="#1E2023" />
                      </svg>
                    </div>

                    {isMapTypeOpen && (
                      <div className="map-type-dropdown">
                        {mapTypes.map(type => (
                          <div
                            key={type}
                            className="map-type-option"
                            onClick={() => {
                              setMapType(type);
                              setIsMapTypeOpen(false);
                            }}
                          >
                            {type}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Left - GPS and Zoom Controls */}
                <div className="map-control-bottom-left">
                  {isLocationMarkerMode ? (
                    <div className="location-marker-controls">
                      <button className="cancel-marker-btn" onClick={handleCancelLocationMarker}>
                        لغو
                      </button>
                      <button className="add-place-btn" onClick={handleAddPlaceToMarker}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M2.70898 8.4527C2.70898 4.37019 5.96316 1.04163 10.0007 1.04163C14.0381 1.04163 17.2923 4.37019 17.2923 8.4527C17.2923 10.4236 16.7306 12.5399 15.7377 14.3682C14.746 16.1942 13.297 17.781 11.4844 18.6282C10.5428 19.0683 9.45851 19.0683 8.51689 18.6282C6.70429 17.781 5.25533 16.1942 4.26361 14.3682C3.27067 12.5399 2.70898 10.4236 2.70898 8.4527ZM10.0007 2.29163C6.67435 2.29163 3.95898 5.03953 3.95898 8.4527C3.95898 10.2003 4.46118 12.1128 5.36207 13.7716C6.26418 15.4327 7.539 16.7913 9.04619 17.4958C9.65236 17.7791 10.3489 17.7791 10.9551 17.4958C12.4623 16.7913 13.7371 15.4327 14.6392 13.7716C15.5401 12.1128 16.0423 10.2003 16.0423 8.4527C16.0423 5.03953 13.327 2.29163 10.0007 2.29163ZM10.0007 5.62496C10.3458 5.62496 10.6257 5.90478 10.6257 6.24996V7.70829H12.084C12.4292 7.70829 12.709 7.98811 12.709 8.33329C12.709 8.67847 12.4292 8.95829 12.084 8.95829H10.6257V10.4166C10.6257 10.7618 10.3458 11.0416 10.0007 11.0416C9.65547 11.0416 9.37565 10.7618 9.37565 10.4166V8.95829H7.91732C7.57214 8.95829 7.29232 8.67847 7.29232 8.33329C7.29232 7.98811 7.57214 7.70829 7.91732 7.70829H9.37565V6.24996C9.37565 5.90478 9.65547 5.62496 10.0007 5.62496Z" fill="white" />
                        </svg>
                        افزودن مکان روی نشانگر تنظیم شده
                      </button>
                    </div>
                  ) : (
                    !isMapFullscreen && (
                      <button className="zoom-map-button" onClick={handleFullscreenMap}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M11.9426 1.25H12.0574C14.3658 1.24999 16.1748 1.24998 17.5863 1.43975C19.031 1.63399 20.1711 2.03933 21.0659 2.93414C21.9607 3.82895 22.366 4.96897 22.5603 6.41371C22.75 7.82519 22.75 9.63423 22.75 11.9426V12.0574C22.75 14.3658 22.75 16.1748 22.5603 17.5863C22.366 19.031 21.9607 20.1711 21.0659 21.0659C20.1711 21.9607 19.031 22.366 17.5863 22.5603C16.1748 22.75 14.3658 22.75 12.0574 22.75H11.9426C9.63423 22.75 7.82519 22.75 6.41371 22.5603C4.96897 22.366 3.82895 21.9607 2.93414 21.0659C2.03933 20.1711 1.63399 19.031 1.43975 17.5863C1.24998 16.1748 1.24999 14.3658 1.25 12.0574V11.9426C1.24999 9.63423 1.24998 7.82519 1.43975 6.41371C1.63399 4.96897 2.03933 3.82895 2.93414 2.93414C3.82895 2.03933 4.96897 1.63399 6.41371 1.43975C7.82519 1.24998 9.63423 1.24999 11.9426 1.25ZM6.61358 2.92637C5.33517 3.09825 4.56445 3.42514 3.9948 3.9948C3.42514 4.56445 3.09825 5.33517 2.92637 6.61358C2.75159 7.91356 2.75 9.62177 2.75 12C2.75 14.3782 2.75159 16.0864 2.92637 17.3864C3.09825 18.6648 3.42514 19.4355 3.9948 20.0052C4.56445 20.5749 5.33517 20.9018 6.61358 21.0736C7.91356 21.2484 9.62177 21.25 12 21.25C14.3782 21.25 16.0864 21.2484 17.3864 21.0736C18.6648 20.9018 19.4355 20.5749 20.0052 20.0052C20.5749 19.4355 20.9018 18.6648 21.0736 17.3864C21.2484 16.0864 21.25 14.3782 21.25 12C21.25 9.62177 21.2484 7.91356 21.0736 6.61358C20.9018 5.33517 20.5749 4.56445 20.0052 3.9948C19.4355 3.42514 18.6648 3.09825 17.3864 2.92637C16.0864 2.75159 14.3782 2.75 12 2.75C9.62177 2.75 7.91356 2.75159 6.61358 2.92637ZM10.7474 5.99364C10.7509 6.40784 10.4179 6.74646 10.0038 6.74997C9.14788 6.75723 8.55011 6.7855 8.10037 6.8736C7.67158 6.95759 7.43423 7.08568 7.25996 7.25996C7.08568 7.43423 6.95759 7.67158 6.8736 8.10037C6.7855 8.55011 6.75723 9.14788 6.74997 10.0038C6.74646 10.4179 6.40784 10.7509 5.99364 10.7474C5.57944 10.7439 5.24652 10.4052 5.25003 9.99103C5.25724 9.14035 5.28357 8.41444 5.40157 7.81203C5.52367 7.18869 5.75316 6.64543 6.1993 6.1993C6.64543 5.75316 7.18869 5.52367 7.81203 5.40157C8.41444 5.28357 9.14035 5.25724 9.99103 5.25003C10.4052 5.24652 10.7439 5.57944 10.7474 5.99364ZM13.2502 5.99364C13.2537 5.57944 13.5923 5.24652 14.0065 5.25003C14.8572 5.25724 15.5831 5.28357 16.1855 5.40157C16.8089 5.52367 17.3521 5.75316 17.7983 6.1993C18.2444 6.64543 18.4739 7.18869 18.596 7.81203C18.714 8.41444 18.7403 9.14035 18.7475 9.99103C18.751 10.4052 18.4181 10.7439 18.0039 10.7474C17.5897 10.7509 17.2511 10.4179 17.2476 10.0038C17.2403 9.14788 17.2121 8.55011 17.124 8.10037C17.04 7.67158 16.9119 7.43423 16.7376 7.25996C16.5633 7.08568 16.326 6.95759 15.8972 6.8736C15.4475 6.7855 14.8497 6.75723 13.9938 6.74997C13.5796 6.74646 13.2467 6.40784 13.2502 5.99364ZM5.99364 13.2502C6.40784 13.2467 6.74646 13.5796 6.74997 13.9938C6.75723 14.8497 6.7855 15.4475 6.8736 15.8972C6.95759 16.326 7.08568 16.5633 7.25996 16.7376C7.43423 16.9119 7.67158 17.04 8.10037 17.124C8.55011 17.2121 9.14788 17.2403 10.0038 17.2476C10.4179 17.2511 10.7509 17.5897 10.7474 18.0039C10.7439 18.4181 10.4052 18.751 9.99103 18.7475C9.14035 18.7403 8.41444 18.714 7.81203 18.596C7.18869 18.4739 6.64543 18.2444 6.1993 17.7983C5.75316 17.3521 5.52367 16.8089 5.40157 16.1855C5.28357 15.5831 5.25724 14.8572 5.25003 14.0065C5.24652 13.5923 5.57944 13.2537 5.99364 13.2502ZM18.0039 13.2502C18.4181 13.2537 18.751 13.5923 18.7475 14.0065C18.7403 14.8572 18.714 15.5831 18.596 16.1855C18.4739 16.8089 18.2444 17.3521 17.7983 17.7983C17.3521 18.2444 16.8089 18.4739 16.1855 18.596C15.5831 18.714 14.8572 18.7403 14.0065 18.7475C13.5923 18.751 13.2537 18.4181 13.2502 18.0039C13.2467 17.5897 13.5796 17.2511 13.9938 17.2476C14.8497 17.2403 15.4475 17.2121 15.8972 17.124C16.326 17.04 16.5633 16.9119 16.7376 16.7376C16.9119 16.5633 17.04 16.326 17.124 15.8972C17.2121 15.4475 17.2403 14.8497 17.2476 13.9938C17.2511 13.5796 17.5897 13.2467 18.0039 13.2502Z" fill="white" />
                        </svg>
                        <span>بزرگنمایی نقشه</span>
                      </button>
                    )
                  )}
                </div>

                {/* Bottom Right - Zoom Map Button */}
                <div className="map-control-bottom-right">
                  <div className="gps-zoom-controls">
                    <div className="zoom-controls">
                      <button className="control-button zoom-in" onClick={handleZoomIn}>
                        <svg width="15" height="14" viewBox="0 0 15 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13.4722 7.75H1.02778C0.602593 7.75 0.25 7.41 0.25 7C0.25 6.59 0.602593 6.25 1.02778 6.25H13.4722C13.8974 6.25 14.25 6.59 14.25 7C14.25 7.41 13.8974 7.75 13.4722 7.75Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.5" />
                          <path d="M7.25043 13.75C6.82525 13.75 6.47266 13.41 6.47266 13V1C6.47266 0.59 6.82525 0.25 7.25043 0.25C7.67562 0.25 8.02821 0.59 8.02821 1V13C8.02821 13.41 7.67562 13.75 7.25043 13.75Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.5" />
                        </svg>
                      </button>
                      <button className="control-button zoom-out" onClick={handleZoomOut}>
                        <svg width="15" height="14" viewBox="0 0 15 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M13.4722 1.75H1.02778C0.602593 1.75 0.25 1.41 0.25 1C0.25 0.59 0.602593 0.25 1.02778 0.25H13.4722C13.8974 0.25 14.25 0.59 14.25 1C14.25 1.41 13.8974 1.75 13.4722 1.75Z" fill="#1E2023" stroke="#1E2023" strokeWidth="0.5" />
                        </svg>
                      </button>
                    </div>
                    <button className="control-button gps-button" onClick={handleGPS}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V3.28169C16.9842 3.64113 20.3589 7.01581 20.7183 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H20.7183C20.3589 16.9842 16.9842 20.3589 12.75 20.7183V22C12.75 22.4142 12.4142 22.75 12 22.75C11.5858 22.75 11.25 22.4142 11.25 22V20.7183C7.01581 20.3589 3.64113 16.9842 3.28169 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H3.28169C3.64113 7.01581 7.01581 3.64113 11.25 3.28169V2C11.25 1.58579 11.5858 1.25 12 1.25ZM12 4.75C7.99594 4.75 4.75 7.99594 4.75 12C4.75 16.0041 7.99594 19.25 12 19.25C16.0041 19.25 19.25 16.0041 19.25 12C19.25 7.99594 16.0041 4.75 12 4.75ZM12 9.75C10.7574 9.75 9.75 10.7574 9.75 12C9.75 13.2426 10.7574 14.25 12 14.25C13.2426 14.25 14.25 13.2426 14.25 12C14.25 10.7574 13.2426 9.75 12 9.75ZM8.25 12C8.25 9.92893 9.92893 8.25 12 8.25C14.0711 8.25 15.75 9.92893 15.75 12C15.75 14.0711 14.0711 15.75 12 15.75C9.92893 15.75 8.25 14.0711 8.25 12Z" fill="#1E2023" />
                        <path d="M9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z" fill="#1E2023" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Charts Section */
            <div className="charts-section">
              {/* Middle Chart Container */}
              <div className="chart-container-middle">
                {/* Top stats section */}
                <div className="stats-cards-container">
                  <div className="stat-card">
                    <div className="stat-card-icon">
                      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="48" height="48" rx="24" fill="#0F71EF" />
                        <rect x="4" y="4" width="48" height="48" rx="24" stroke="#F5F6FF" strokeWidth="8" />
                        <path d="M28.1706 36.6377C27.2958 36.6377 26.4291 36.3809 25.7469 35.8753L22.2958 33.299C21.3809 32.6169 20.6666 31.1963 20.6666 30.0567V24.0936C20.6666 22.8576 21.5735 21.5414 22.7373 21.108L26.7421 19.6072C27.5366 19.3103 28.7886 19.3103 29.5832 19.6072L33.596 21.108C34.7597 21.5414 35.6666 22.8576 35.6666 24.0936V30.0567C35.6666 31.1963 34.9523 32.6169 34.0374 33.299L30.5864 35.8753C29.9122 36.3809 29.0454 36.6377 28.1706 36.6377ZM27.1674 20.7308L23.1626 22.2316C22.4724 22.4885 21.8705 23.3552 21.8705 24.0936V30.0567C21.8705 30.8191 22.4082 31.8865 23.0101 32.336L26.4612 34.9122C27.3841 35.6024 28.9491 35.6024 29.8721 34.9122L33.3231 32.336C33.9331 31.8785 34.4628 30.8111 34.4628 30.0567V24.0936C34.4628 23.3633 33.8608 22.4965 33.1706 22.2316L29.1658 20.7308C28.6361 20.5302 27.7051 20.5302 27.1674 20.7308Z" fill="white" />
                        <path d="M27.1674 20.7308L23.1626 22.2316C22.4724 22.4885 21.8705 23.3552 21.8705 24.0936V30.0567C21.8705 30.8191 22.4082 31.8865 23.0101 32.336L26.4612 34.9122C27.3841 35.6024 28.9491 35.6024 29.8721 34.9122L33.3231 32.336C33.9331 31.8785 34.4628 30.8111 34.4628 30.0567V24.0936C34.4628 23.3633 33.8608 22.4965 33.1706 22.2316L29.1658 20.7308C28.6361 20.5302 27.7051 20.5302 27.1674 20.7308Z" fill="white" />
                        <path d="M28.1706 27.7373H28.1144C26.9507 27.7052 26.1 26.8143 26.1 25.7309C26.1 24.6233 27.0069 23.7164 28.1144 23.7164C29.222 23.7164 30.1289 24.6233 30.1289 25.7309C30.1284 26.2526 29.9258 26.7539 29.5637 27.1295C29.2016 27.5051 28.708 27.7258 28.1866 27.7453C28.1786 27.7373 28.1786 27.7373 28.1706 27.7373ZM28.1144 24.9203C27.665 24.9203 27.3038 25.2814 27.3038 25.7309C27.3038 26.1723 27.6489 26.5254 28.0823 26.5415H28.1706C28.3764 26.5291 28.5695 26.438 28.71 26.2871C28.8504 26.1362 28.9274 25.937 28.925 25.7309C28.9261 25.6241 28.9058 25.5182 28.8655 25.4194C28.8251 25.3206 28.7655 25.2308 28.69 25.1553C28.6145 25.0798 28.5247 25.0202 28.4259 24.9798C28.327 24.9394 28.2212 24.9192 28.1144 24.9203ZM28.1706 32.2959C27.4804 32.2959 26.7822 32.1113 26.2444 31.7501C25.7067 31.397 25.4017 30.8761 25.4017 30.3224C25.4017 29.7686 25.7067 29.2469 26.2444 28.8858C27.3279 28.1635 29.0213 28.1715 30.0968 28.8858C30.6345 29.2389 30.9395 29.7606 30.9395 30.3143C30.9395 30.8681 30.6345 31.3898 30.0968 31.7509C29.559 32.1121 28.8608 32.2959 28.1706 32.2959ZM26.9106 29.8802C26.7099 30.0086 26.5976 30.1691 26.6056 30.3135C26.6056 30.458 26.7179 30.6185 26.9106 30.7469C27.5847 31.1964 28.7565 31.1964 29.4306 30.7469C29.6313 30.6185 29.7436 30.458 29.7436 30.3135C29.7436 30.1691 29.6313 30.0086 29.4387 29.8802C28.7645 29.4387 27.5847 29.4387 26.9106 29.8802Z" fill="#0F71EF" />
                      </svg>
                    </div>
                    <div className="stat-card-content">
                      <div className="stat-card-title">تعداد کاربران</div>
                      <div className="stat-card-value">۱,۴۵۶,۰۰۳</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-icon">
                      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="48" height="48" rx="24" fill="#0F71EF" />
                        <rect x="4" y="4" width="48" height="48" rx="24" stroke="#F5F6FF" strokeWidth="8" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M33.417 29.6667C31.8062 29.6667 30.5003 30.882 30.5003 32.3811C30.5003 33.8685 31.4312 35.6042 32.8836 36.2248C33.2222 36.3695 33.6118 36.3695 33.9504 36.2248C35.4028 35.6042 36.3337 33.8685 36.3337 32.3811C36.3337 30.882 35.0278 29.6667 33.417 29.6667ZM33.417 33.4167C33.8772 33.4167 34.2503 33.0436 34.2503 32.5834C34.2503 32.1231 33.8772 31.75 33.417 31.75C32.9568 31.75 32.5837 32.1231 32.5837 32.5834C32.5837 33.0436 32.9568 33.4167 33.417 33.4167Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M22.5837 19.6667C20.9728 19.6667 19.667 20.882 19.667 22.3811C19.667 23.8685 20.5979 25.6042 22.0503 26.2248C22.3889 26.3695 22.7784 26.3695 23.117 26.2248C24.5694 25.6042 25.5003 23.8685 25.5003 22.3811C25.5003 20.882 24.1945 19.6667 22.5837 19.6667ZM22.5837 23.4167C23.0439 23.4167 23.417 23.0436 23.417 22.5834C23.417 22.1231 23.0439 21.75 22.5837 21.75C22.1234 21.75 21.7503 22.1231 21.7503 22.5834C21.7503 23.0436 22.1234 23.4167 22.5837 23.4167Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M27.3748 22.1667C27.3748 21.8215 27.6546 21.5417 27.9998 21.5417H31.443C33.7357 21.5417 34.6076 24.5359 32.6733 25.7667L23.9973 31.2879C23.1181 31.8474 23.5144 33.2084 24.5565 33.2084H26.4909L26.3078 33.0253C26.0637 32.7812 26.0637 32.3855 26.3078 32.1414C26.5519 31.8973 26.9476 31.8973 27.1917 32.1414L28.4417 33.3914C28.6858 33.6355 28.6858 34.0312 28.4417 34.2753L27.1917 35.5253C26.9476 35.7694 26.5519 35.7694 26.3078 35.5253C26.0637 35.2812 26.0637 34.8855 26.3078 34.6414L26.4909 34.4584H24.5565C22.2638 34.4584 21.3919 31.4642 23.3262 30.2333L32.0022 24.7122C32.8814 24.1527 32.4851 22.7917 31.443 22.7917H27.9998C27.6546 22.7917 27.3748 22.5119 27.3748 22.1667Z" fill="white" />
                      </svg>

                    </div>
                    <div className="stat-card-content">
                      <div className="stat-card-title">مسیریابی های موفق</div>
                      <div className="stat-card-value">۷۲۸,۱۰۵</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-card-icon">
                      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="4" width="48" height="48" rx="24" fill="#0F71EF" />
                        <rect x="4" y="4" width="48" height="48" rx="24" stroke="#F5F6FF" strokeWidth="8" />
                        <path d="M28.0003 36.3336C32.6027 36.3336 36.3337 34.6546 36.3337 32.5836C36.3337 31.528 35.3645 30.5744 33.8048 29.8929C32.8531 31.6394 31.4018 33.1448 29.5583 33.9326C28.5673 34.3561 27.4333 34.3561 26.4424 33.9326C24.5989 33.1448 23.1475 31.6394 22.1958 29.8929C20.6361 30.5744 19.667 31.528 19.667 32.5836C19.667 34.6546 23.398 36.3336 28.0003 36.3336Z" fill="white" />
                        <path fillRule="evenodd" clipRule="evenodd" d="M22.167 25.0955C22.167 22.0973 24.7787 19.6667 28.0003 19.6667C31.222 19.6667 33.8337 22.0973 33.8337 25.0955C33.8337 28.0703 31.9719 31.5416 29.067 32.783C28.3899 33.0724 27.6108 33.0724 26.9336 32.783C24.0288 31.5416 22.167 28.0703 22.167 25.0955ZM28.0003 27.1667C28.9208 27.1667 29.667 26.4205 29.667 25.5C29.667 24.5795 28.9208 23.8334 28.0003 23.8334C27.0799 23.8334 26.3337 24.5795 26.3337 25.5C26.3337 26.4205 27.0799 27.1667 28.0003 27.1667Z" fill="white" />
                      </svg>


                    </div>
                    <div className="stat-card-content">
                      <div className="stat-card-title">مراکز فرهنگی موجود</div>
                      <div className="stat-card-value">۱۵۶</div>
                    </div>
                  </div>
                </div>

                {/* Chart section */}
                <div className="middle-chart-content">
                  <div className="chart-header">
                    <div className="chart-title">
                      <h3>آمار بازدید هفته اخیر کاربران</h3>
                      <p>تعداد بازدید کاربران فعال از اپلیکیشن در هفته اخیر</p>
                    </div>
                    <div className="chart-filter" onClick={() => setIsBarChartFilterOpen(!isBarChartFilterOpen)}>
                      <span>{barChartTimeFilter}</span>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" d="M3.69213 7.09327C3.91677 6.83119 4.31133 6.80084 4.57341 7.02548L10 11.6768L15.4266 7.02548C15.6887 6.80084 16.0832 6.83119 16.3079 7.09327C16.5325 7.35535 16.5022 7.74991 16.2401 7.97455L10.4067 12.9745C10.1727 13.1752 9.82731 13.1752 9.59326 12.9745L3.75992 7.97455C3.49784 7.74991 3.46749 7.35535 3.69213 7.09327Z" fill="#1E2023" />
                      </svg>

                      {isBarChartFilterOpen && (
                        <div className="time-filter-dropdown show">
                          <div className="time-filter-option" onClick={() => setBarChartTimeFilter('امروز')}>امروز</div>
                          <div className="time-filter-option" onClick={() => setBarChartTimeFilter('هفته اخیر')}>هفته اخیر</div>
                          <div className="time-filter-option" onClick={() => setBarChartTimeFilter('ماه اخیر')}>ماه اخیر</div>
                          <div className="time-filter-option" onClick={() => setBarChartTimeFilter('سه ماه اخیر')}>سه ماه اخیر</div>
                          <div className="time-filter-option" onClick={() => setBarChartTimeFilter('سال اخیر')}>سال اخیر</div>
                          <div className="time-filter-option" onClick={() => setBarChartTimeFilter('همه زمان')}>همه زمان</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bar-chart-container">


                    <div className="chart-area">
                      {/* Horizontal grid lines */}
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>

                      {/* Bars */}
                      <div className="bars-container">
                        {barData.map((bar, index) => (
                          <div
                            key={bar.day}
                            className="bar-wrapper"
                            onClick={() => setSelectedBar(selectedBar === index ? null : index)}
                          >
                            <div
                              className={`bar ${selectedBar === index ? 'selected' : ''} ${selectedBar !== null && selectedBar !== index ? 'dimmed' : ''}`}
                              style={{ height: `${bar.value}%` }}
                            >
                              {selectedBar === index && (
                                <div className="bar-value">{bar.count} نفر</div>
                              )}
                            </div>
                            <div className="x-label">{bar.day}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="y-axis">
                      <div className="y-label">۱۰۱ - ۲۰۰</div>
                      <div className="y-label">۵۱ - ۱۰۰</div>
                      <div className="y-label">۱ - ۵۰</div>
                      <div className="y-label">۰</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Left Chart Container - Pie Chart */}
              <div className="chart-container-left">
                <div className="chart-header-with-filter">
                  <h3>نظرات ثبت شده</h3>
                  <div className="time-filter" onClick={() => setIsPieChartFilterOpen(!isPieChartFilterOpen)}>
                    <span>{pieChartTimeFilter}</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M3.64645 5.64645C3.84171 5.45118 4.15829 5.45118 4.35355 5.64645L8 9.29289L11.6464 5.64645C11.8417 5.45118 12.1583 5.45118 12.3536 5.64645C12.5488 5.84171 12.5488 6.15829 12.3536 6.35355L8.35355 10.3536C8.15829 10.5488 7.84171 10.5488 7.64645 10.3536L3.64645 6.35355C3.45118 6.15829 3.45118 5.84171 3.64645 5.64645Z" fill="#1E2023" />
                    </svg>

                    {isPieChartFilterOpen && (
                      <div className="time-filter-dropdown show">
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('امروز')}>امروز</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('هفته اخیر')}>هفته اخیر</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('ماه اخیر')}>ماه اخیر</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('سه ماه اخیر')}>سه ماه اخیر</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('سال اخیر')}>سال اخیر</div>
                        <div className="time-filter-option" onClick={() => setPieChartTimeFilter('همه زمان')}>همه زمان</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pie-chart-wrapper">
                  <div className="pie-chart-main">
                    <div className="pie-chart-visual" style={{
                      background: `conic-gradient(#0F71EF 0deg ${approvedDegrees}deg, white ${approvedDegrees}deg ${approvedDegrees + 2}deg, #F44336 ${approvedDegrees + 2}deg ${approvedDegrees + rejectedDegrees + 2}deg, white ${approvedDegrees + rejectedDegrees + 2}deg ${approvedDegrees + rejectedDegrees + 4}deg, #F2F2F2 ${approvedDegrees + rejectedDegrees + 4}deg 360deg)`
                    }}>
                      <div className="pie-center"></div>
                    </div>
                  </div>
                </div>

                <div className="table-header">
                  <span>نظرات و حالت ها</span>
                  <span>تعداد</span>
                </div>
                <div className="comments-table">
                  <div className="table-row2">
                    <span>کل نظرات ثبت شده (مرداد)</span>
                    <span className="count-value">{commentStats.total}</span>
                  </div>

                  <div className="table-row">
                    <div className="stat-info">
                      <div className="stat-color approved"></div>
                      <span>تایید و انتشار</span>
                    </div>
                    <div className="count-value">{commentStats.approved}</div>
                  </div>
                  <div className="table-row">
                    <div className="stat-info">
                      <div className="stat-color rejected"></div>
                      <span>رد شده</span>
                    </div>
                    <div className="count-value">{commentStats.rejected}</div>
                  </div>
                  {/* <div className="table-row">
                  <div className="stat-info">
                    <div className="stat-color unknown"></div>
                    <span>در انتظار بررسی</span>
                  </div>
                  <div className="count-value">{unknownComments}</div>
                </div> */}
                </div>
              </div>
            </div>
          )}

          {/* User Search and Table */}
          <div className="users-section">
            <div className="section-header">
              <div className="section-header-top">
                <div className="title-container">
                  <div className="title-cell">
                    <h3>آخرین کاربران ثبت نام شده در اپلیکیشن</h3>
                    <button className="refresh-btn">
                      <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M11.047 5.99994C11.047 8.73518 8.8271 10.9551 6.09186 10.9551C3.35662 10.9551 1.68674 8.20002 1.68674 8.20002M1.68674 8.20002H3.92646M1.68674 8.20002V10.6776M1.13672 5.99994C1.13672 3.2647 3.3368 1.0448 6.09186 1.0448C9.39694 1.0448 11.047 3.79986 11.047 3.79986M11.047 3.79986V1.32229M11.047 3.79986H8.84692" stroke="#1E2023" strokeWidth="1.08112" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <p>لورم اپیسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ و با استفاده از طراحان گرافیک است.</p>
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

                  {currentReportView !== 'کاربران ثبت نام کرده' && (
                    <button className="seeInfo-btn">
                      مشاهده همه گزارش
                    </button>
                  )}
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
                          <div className="profile-image-small"></div>
                          <strong>{user.fullName}</strong>
                        </div>
                      </td>
                      <td>{user.phone}</td>
                      <td>{user.registerDate}</td>
                      <td>{user.gender}</td>
                      <td>
                        <span className="success-count">{Math.floor(Math.random() * 5) + 1} بار</span>
                      </td>
                      <td>
                        <button className="details-btn">
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

              {/* Add pagination controls */}
              <div className="pagination-container">
                {/* <div className="pagination-info">
                  <span>نمایش</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(e.target.value)}
                    className="items-per-page-select"
                  >
                    <option value="5">۵</option>
                    <option value="10">۱۰</option>
                    <option value="15">۱۵</option>
                    <option value="20">۲۰</option>
                  </select>
                  <span>از {totalItems} مورد</span>
                </div> */}

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
        </div>
      </div>
      {/* Add Place Modal */}
      {isAddPlaceModalOpen && (
        <div className="modal-overlay">
          <div className="add-place-modal">
            {/* Modal Header - UNCHANGED */}
            <div className="modal-header">
              <div className="step-text">
                مرحله {currentStep} از ۳ :
                <span className="step-title">
                  {currentStep === 1 && 'اطلاعات اولیه و کلی مکان'}
                  {currentStep === 2 && 'اطلاعات و جزئیات تکمیلی مکان'}
                  {currentStep === 3 && 'افزودن محدودیت های زمانی'}
                </span>
              </div>
              <div className="step-progress">
                <div className={`step-circle ${currentStep >= 1 ? 'active' : ''}`}>
                  {currentStep > 1 ? '✓' : '۱'}
                </div>
                <div className={`step-line ${currentStep >= 2 ? 'active' : ''}`}></div>
                <div className={`step-circle ${currentStep >= 2 ? 'active' : ''}`}>
                  {currentStep > 2 ? '✓' : '۲'}
                </div>
                <div className={`step-line ${currentStep >= 3 ? 'active' : ''}`}></div>
                <div className={`step-circle ${currentStep >= 3 ? 'active' : ''}`}>
                  {currentStep > 3 ? '✓' : '۳'}
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="modal-content">
              {currentStep === 1 && (
                <div className="step-content">
                  <div className="step-intro">
                    <h3>فرم و فرایند ایجاد و افزودن یک نقطه و مکان جدید</h3>
                  </div>

                  <div className="form-section">
                    <div className="form-group">
                      <label className="form-label">نام و توضیحات این مکان </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="نام نقطه و مکان"
                        value={placeName}
                        onChange={(e) => setPlaceName(e.target.value)}
                      />
                      <textarea
                        className="form-textarea"
                        placeholder="توضیحات بیشتر درباره این نقطه و مکان ..."
                        value={fullDescription}
                        onChange={(e) => setFullDescription(e.target.value)}
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">تعیین گروه این مکان </label>
                      <div className="dropdown-group">
                        <div className="dropdown-field">
                          <select
                            className="form-input"
                            value={placeCategory}
                            onChange={(e) => setPlaceCategory(e.target.value)}
                          >
                            <option value="" disabled>گروه اصلی</option>
                            <option value="حرم">حرم مطهر</option>
                            <option value="صحن">صحن ها</option>
                            <option value="رواق">رواق ها</option>
                            <option value="مسجد">مساجد</option>
                            <option value="مدرسه">مدارس علمیه</option>
                            <option value="موزه">موزه ها</option>
                          </select>
                        </div>

                        <div className="dropdown-field">
                          <select
                            className="form-input"
                            value={placeSubcategory}
                            onChange={(e) => setPlaceSubcategory(e.target.value)}
                            disabled={!placeCategory}
                          >
                            <option value="" disabled>زیرگروه</option>
                            <option value="صحن-انقلاب">صحن انقلاب اسلامی</option>
                            <option value="صحن-قدس">صحن قدس</option>
                            <option value="صحن-جمهوری">صحن جمهوری اسلامی</option>
                            <option value="رواق-امام">رواق امام خمینی</option>
                            <option value="رواق-دارالحجه">رواق دارالحجه</option>
                            <option value="رواق-دارالولایه">رواق دارالولایه</option>
                            <option value="رواق-کوثر">رواق کوثر</option>
                          </select>
                        </div>

                        <div className="dropdown-field">
                          <select
                            className="form-input"
                            value={placeFunction}
                            onChange={(e) => setPlaceFunction(e.target.value)}
                            disabled={!placeSubcategory}
                          >
                            <option value="" disabled>کارکرد گروه</option>
                            <option value="عبادی">عبادی</option>
                            <option value="فرهنگی">فرهنگی</option>
                            <option value="خدماتی">خدماتی</option>
                            <option value="امکانات">امکانات رفاهی</option>
                            <option value="اطلاعات">مرکز اطلاعات</option>
                            <option value="زیارتی">زیارتی</option>
                            <option value="سیاحتی">سیاحتی</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="step-content step2-content">
                  <div className="step-intro">
                    <h3>فرم و فرایند ایجاد و افزودن یک نقطه و مکان جدید</h3>
                  </div>

                  <div className="form-section">
                    {/* Place Type Section */}
                    <div className="form-group">
                      <label className="form-label">نوع این مکان </label>
                      <div className="multi-select-grid">
                        {['زیارتی', 'فرهنگی', 'خدماتی', 'تاریخی', 'معماری'].map((type) => (
                          <div
                            key={type}
                            className={`select-option ${selectedPlaceTypes.includes(type) ? 'selected' : ''}`}
                            onClick={() => {
                              if (selectedPlaceTypes.includes(type)) {
                                setSelectedPlaceTypes(selectedPlaceTypes.filter(t => t !== type));
                              } else {
                                setSelectedPlaceTypes([...selectedPlaceTypes, type]);
                              }
                            }}
                          >
                            <div className="option-content">
                              <span>{type}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Transportation Type Section - Multi-select */}
                    <div className="form-group">
                      <label className="form-label">نوع تردد زائرین محترم از این مکان</label>
                      <div className="radio-options-grid2"> {/* Keep original class */}
                        {[
                          { value: 'electric_car', label: 'ویلچر ', icon: 'electric' },
                          { value: 'wheelchair', label: 'ون برقی', icon: 'wheelchair' },
                          { value: 'walking', label: 'به صورت پیاده', icon: 'walking' }
                        ].map((transport) => (
                          <div
                            key={transport.value}
                            className={`radio-option2 ${selectedTransport.includes(transport.value) ? 'selected' : ''}`}
                            onClick={() => {
                              if (selectedTransport.includes(transport.value)) {
                                setSelectedTransport(selectedTransport.filter(t => t !== transport.value));
                              } else {
                                setSelectedTransport([...selectedTransport, transport.value]);
                              }
                            }}
                          >
                            <div className="option-content">
                              <div className="icon-text">
                                {transport.icon === 'electric' && (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    {/* SVG paths remain same */}
                                  </svg>
                                )}
                                {transport.icon === 'wheelchair' && (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    {/* SVG paths remain same */}
                                  </svg>
                                )}
                                {transport.icon === 'walking' && (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    {/* SVG paths remain same */}
                                  </svg>
                                )}
                                <span>{transport.label}</span>
                              </div>
                              <div className="checkbox-container">
                                {selectedTransport.includes(transport.value) ? (
                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M10 20C5.28595 20 2.92893 20 1.46447 18.5355C0 17.0711 0 14.714 0 10C0 5.28595 0 2.92893 1.46447 1.46447C2.92893 0 5.28595 0 10 0C14.714 0 17.0711 0 18.5355 1.46447C20 2.92893 20 5.28595 20 10C20 14.714 20 17.0711 18.5355 18.5355C17.0711 20 14.714 20 10 20ZM14.0303 6.96967C14.3232 7.26256 14.3232 7.73744 14.0303 8.03033L9.03033 13.0303C8.73744 13.3232 8.26256 13.3232 7.96967 13.0303L5.96967 11.0303C5.67678 10.7374 5.67678 10.2626 5.96967 9.96967C6.26256 9.67678 6.73744 9.67678 7.03033 9.96967L8.5 11.4393L12.9697 6.96967C13.2626 6.67678 13.7374 6.67678 14.0303 6.96967Z" fill="#0F71EF" />
                                  </svg>
                                ) : (
                                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <rect x="0.5" y="0.5" width="19" height="19" rx="3.5" stroke="#D9D9D9" />
                                  </svg>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Gender Access Section - Multi-select */}
                    <div className="form-group">
                      <label className="form-label">جنسیت تردد زائرین محترم از این مکان</label>
                      <div className="radio-options-grid3"> {/* Keep original class */}
                        {['بانوان', 'مردان', 'خانوادگی'].map((gender) => (
                          <div
                            key={gender}
                            className={`radio-option3 ${selectedGenderAccess.includes(gender) ? 'selected' : ''}`}
                            onClick={() => {
                              if (selectedGenderAccess.includes(gender)) {
                                setSelectedGenderAccess(selectedGenderAccess.filter(g => g !== gender));
                              } else {
                                setSelectedGenderAccess([...selectedGenderAccess, gender]);
                              }
                            }}
                          >
                            <div className="option-content5">
                              <div className="radio-container">
                                {selectedGenderAccess.includes(gender) ? (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="0.5" y="0.5" width="15" height="15" rx="7.5" stroke="white" />
                                    <circle cx="8.00065" cy="8.00004" r="4.00065" fill="white" />
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="0.5" y="0.5" width="15" height="15" rx="7.5" stroke="#858585" />
                                  </svg>
                                )}
                              </div>
                              <span>مسیر مناسب {gender}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="step-content step3-content">
                  <div className="step-intro">
                    <h3>فرم و فرایند ایجاد و افزودن یک نقطه و مکان جدید</h3>
                  </div>

                  <div className="form-section">
                    {/* Time-based Restrictions Section */}
                    <div className="restriction-section">
                      <div className="restriction-header">
                        <span className="restriction-title">محدودیت بر اساس روز، ساعت و جنسیت</span>
                        <button className="add-restriction-btn" onClick={addTimeRestriction}>
                          افزودن محدودیت
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </button>
                      </div>

                      {timeRestrictions.map((restriction, index) => (
                        <div key={restriction.id} className="restriction-item">
                          <div className="restriction-content">
                            <div className="restriction-row">
                              <div className="form-group compact">
                                <label className="form-label">روزهای هفته</label>
                                <select className="form-input compact" multiple>
                                  <option value="saturday">شنبه</option>
                                  <option value="sunday">یکشنبه</option>
                                  <option value="monday">دوشنبه</option>
                                  <option value="tuesday">سه شنبه</option>
                                  <option value="wednesday">چهارشنبه</option>
                                  <option value="thursday">پنجشنبه</option>
                                  <option value="friday">جمعه</option>
                                </select>
                              </div>

                              <div className="time-inputs">
                                <div className="form-group compact">
                                  <label className="form-label">ساعت شروع</label>
                                  <input type="time" className="form-input compact" />
                                </div>

                                <div className="form-group compact">
                                  <label className="form-label">ساعت پایان</label>
                                  <input type="time" className="form-input compact" />
                                </div>
                              </div>

                              <div className="form-group compact">
                                <label className="form-label">جنسیت</label>
                                <select className="form-input compact">
                                  <option value="">انتخاب کنید</option>
                                  <option value="male">مردان</option>
                                  <option value="female">بانوان</option>
                                  <option value="both">هر دو</option>
                                </select>
                              </div>
                            </div>
                          </div>
                          <button
                            className="remove-restriction-btn"
                            onClick={() => removeTimeRestriction(restriction.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Prayer Time Restrictions Section */}
                    <div className="restriction-section">
                      <div className="restriction-header">
                        <span className="restriction-title">محدودیت بر اساس اوقات شرعی (برای همه روزها)</span>
                        <button className="add-restriction-btn" onClick={addPrayerTimeRestriction}>
                          افزودن محدودیت
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 10.625H5C4.65833 10.625 4.375 10.3417 4.375 10C4.375 9.65833 4.65833 9.375 5 9.375H15C15.3417 9.375 15.625 9.65833 15.625 10C15.625 10.3417 15.3417 10.625 15 10.625Z" fill="#1E2023" />
                            <path d="M10 15.625C9.65833 15.625 9.375 15.3417 9.375 15V5C9.375 4.65833 9.65833 4.375 10 4.375C10.3417 4.375 10.625 4.65833 10.625 5V15C10.625 15.3417 10.3417 15.625 10 15.625Z" fill="#1E2023" />
                          </svg>
                        </button>
                      </div>

                      {prayerTimeRestrictions.map((restriction, index) => (
                        <div key={restriction.id} className="restriction-item">
                          <div className="restriction-content">
                            <div className="restriction-row">
                              <div className="form-group compact">
                                <label className="form-label">نوع وقت شرعی</label>
                                <select className="form-input compact">
                                  <option value="">انتخاب کنید</option>
                                  <option value="fajr">اذان صبح</option>
                                  <option value="sunrise">طلوع آفتاب</option>
                                  <option value="dhuhr">اذان ظهر</option>
                                  <option value="asr">اذان عصر</option>
                                  <option value="maghrib">اذان مغرب</option>
                                  <option value="isha">اذان عشاء</option>
                                </select>
                              </div>

                              <div className="prayer-time-info">
                                <span className="prayer-time-note">این محدودیت برای همه روزهای هفته اعمال خواهد شد</span>
                              </div>
                            </div>
                          </div>
                          <button
                            className="remove-restriction-btn"
                            onClick={() => removePrayerTimeRestriction(restriction.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - UNCHANGED */}
            <div className="modal-footer">
              <button
                className="cancel-btn5"
                onClick={() => {
                  setIsAddPlaceModalOpen(false);
                  resetForm();
                }}
              >
                لغو و بازگشت
              </button>
              <button
                className="confirm-btn"
                onClick={() => {
                  if (currentStep === 1) {
                    // Validate step 1
                    if (placeName && placeCategory && placeSubcategory && placeFunction) {
                      setCurrentStep(2);
                    } else {
                      alert('لطفا تمام فیلدهای ضروری را پر کنید');
                    }
                  } else if (currentStep === 2) {
                    // Validate step 2
                    if (selectedPlaceTypes.length === 0) {
                      alert('لطفا حداقل یک نوع مکان را انتخاب کنید');
                    } else if (selectedTransport.length === 0) {
                      alert('لطفا حداقل یک نوع تردد را انتخاب کنید');
                    } else if (selectedGenderAccess.length === 0) {
                      alert('لطفا حداقل یک جنسیت تردد را انتخاب کنید');
                    } else {
                      setCurrentStep(3);
                    }
                  }
                }}
              >
                {currentStep === 3 ? 'تایید اطلاعات و ثبت این مکان ' : 'تایید اطلاعات و مرحله بعد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default Amain;