// src/pages/ProfileInfo.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import { useUserAuthStore } from '../auth/user/userAuthStore';
import { updateUserMe } from '../services/publicAuthApi';
import apiUser from '../api/apiUser';
import mapApiError from '../services/apiErrorMapper';
import '../styles/ProfileInfo.css';

function ProfileInfo() {
  const navigate = useNavigate();
  const intl = useIntl();
  const fileInputRef = useRef(null);
  const { setSession, accessToken, refreshToken } = useUserAuthStore();

  // User data state - load from localStorage on component mount
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    province: '',
    city: ''
  });

  const [avatar, setAvatar] = useState(null);
  // Add message state
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load user data from localStorage when component mounts
  useEffect(() => {
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      const profileData = JSON.parse(savedProfile);
      setUserData(prevData => ({
        ...prevData,
        ...profileData
      }));

      // Load avatar if exists
      if (profileData.avatar) {
        setAvatar(profileData.avatar);
      }
    }

    // Also check for separate avatar storage
    const savedAvatar = localStorage.getItem('userAvatar');
    if (savedAvatar && !avatar) {
      setAvatar(savedAvatar);
    }
  }, []);

  // Clear message after 3 seconds
  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Iranian provinces and cities data
  const provinces = [
    { id: 1, name: 'تهران', cities: ['تهران', 'شهریار', 'اسلامشهر', 'رباط کریم', 'قدس'] },
    { id: 2, name: 'خراسان رضوی', cities: ['مشهد', 'نیشابور', 'سبزوار', 'قوچان', 'کاشمر'] },
    { id: 3, name: 'اصفهان', cities: ['اصفهان', 'کاشان', 'خمینی شهر', 'شاهین شهر', 'نجف آباد'] },
    { id: 4, name: 'فارس', cities: ['شیراز', 'مرودشت', 'کازرون', 'لار', 'جهرم'] },
    { id: 5, name: 'آذربایجان شرقی', cities: ['تبریز', 'مراغه', 'مرند', 'اهر', 'اسکو'] },
    { id: 6, name: 'مازندران', cities: ['ساری', 'بابل', 'آمل', 'قائم شهر', 'نور'] },
    { id: 7, name: 'خوزستان', cities: ['اهواز', 'آبادان', 'خرمشهر', 'دزفول', 'شوشتر'] },
    { id: 8, name: 'البرز', cities: ['کرج', 'هشتگرد', 'نظرآباد', 'طالقان', 'اشتهارد'] }
  ];

  const [cities, setCities] = useState([]);
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  // Handle avatar upload
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatar(e.target.result);
        // Save to localStorage for persistence
        localStorage.setItem('userAvatar', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));

    // If province changes, update cities list
    if (field === 'province') {
      const selectedProvince = provinces.find(p => p.name === value);
      setCities(selectedProvince ? selectedProvince.cities : []);
      setUserData(prev => ({ ...prev, city: '' }));
    }
  };

  // Handle province selection
  const handleProvinceSelect = (provinceName) => {
    handleInputChange('province', provinceName);
    setShowProvinceDropdown(false);
  };

  // Handle city selection
  const handleCitySelect = (cityName) => {
    handleInputChange('city', cityName);
    setShowCityDropdown(false);
  };

  // Validate phone number
  const isValidPhoneNumber = (phone) => {
    if (!phone) return false;
    const phoneRegex = /^(\+98|0)?9\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    // Remove any non-digit characters and format
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('+98')) {
      return `${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      return `98-${cleaned.substring(1)}+`;
    } else if (cleaned.length === 10) {
      return `98${cleaned}`;
    }
    return phone;
  };

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });

    // Format phone number before sending
    const formattedPhone = formatPhoneNumber(userData.phoneNumber);

    const payload = {
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: formattedPhone,
      province: userData.province,
      city: userData.city
    };

    try {
      await updateUserMe(payload);

      const meData = await apiUser.get('/api/v1/auth/me').then((res) => res.data);
      setSession({
        accessToken,
        refreshToken,
        user: meData,
        profileCompleted: meData?.profileCompleted ?? true
      });

      setMessage({
        type: 'success',
        text: intl.formatMessage({ id: 'profileUpdatedSuccess' })
      });

      const profileCompleted = typeof meData?.profileCompleted === 'boolean'
        ? meData.profileCompleted
        : true;

      if (profileCompleted) {
        setTimeout(() => {
          navigate('/profile');
        }, 800);
      }
    } catch (err) {
      const mapped = mapApiError(err);
      const fieldMessage = mapped.fieldMessages?.[0];
      setMessage({
        type: 'error',
        text: fieldMessage || mapped.message
      });
      if (err?.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get user display name
  const getDisplayName = () => {
    if (userData.firstName && userData.lastName) {
      return `${userData.firstName} ${userData.lastName}`;
    }
    return intl.formatMessage({ id: 'Username' });
  };

  // Check if form is valid
  const isFormValid = userData.firstName && userData.lastName && !isSubmitting;

  return (
    <div className="profile-info-container">
      {/* Message Notification */}
      {message.text && (
        <div className={`message-notification ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Header with Back Arrow and Menu */}
      <div className="profile-info-header">
        <button className="back-arrow3" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M11.2244 4.55806C11.4685 4.31398 11.8642 4.31398 12.1083 4.55806L17.1083 9.55806C17.3524 9.80214 17.3524 10.1979 17.1083 10.4419L12.1083 15.4419C11.8642 15.686 11.4685 15.686 11.2244 15.4419C10.9803 15.1979 10.9803 14.8021 11.2244 14.5581L15.1575 10.625H3.33301C2.98783 10.625 2.70801 10.3452 2.70801 10C2.70801 9.65482 2.98783 9.375 3.33301 9.375H15.1575L11.2244 5.44194C10.9803 5.19786 10.9803 4.80214 11.2244 4.55806Z" fill="black" />
          </svg>
        </button>

        <h1 className="profile-info-title">
          <FormattedMessage id="completeProfileTitle" />
        </h1>

        <button className="menu-button">
          <svg width="50" height="50" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.5" y="0.5" width="43" height="43" rx="21.5" stroke="#D9D9D9" />
            <path d="M26.1667 22.0001C26.1667 21.0796 26.9129 20.3334 27.8333 20.3334C28.7538 20.3334 29.5 21.0796 29.5 22.0001C29.5 22.9206 28.7538 23.6667 27.8333 23.6667C26.9129 23.6667 26.1667 22.9206 26.1667 22.0001Z" fill="#1E2023" />
            <path d="M20.3333 22.0001C20.3333 21.0796 21.0795 20.3334 22 20.3334C22.9205 20.3334 23.6667 21.0796 23.6667 22.0001C23.6667 22.9206 22.9205 23.6667 22 23.6667C21.0795 23.6667 20.3333 22.9206 20.3333 22.0001Z" fill="#1E2023" />
            <path d="M14.5 22.0001C14.5 21.0796 15.2462 20.3334 16.1667 20.3334C17.0871 20.3334 17.8333 21.0796 17.8333 22.0001C17.8333 22.9206 17.0871 23.6667 16.1667 23.6667C15.2462 23.6667 14.5 22.9206 14.5 22.0001Z" fill="#1E2023" />
          </svg>
        </button>
      </div>

      {/* Profile Avatar Section */}
      <div className="profile-avatar-section">
        <div className="avatar-container" onClick={handleAvatarClick}>
          {avatar ? (
            <img src={avatar} alt="Profile Avatar" className="profile-avatar-image" />
          ) : (
            <div className="profile-avatar-default">
              <svg width="55" height="56" viewBox="0 0 55 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_224_9691)">
                  <mask id="mask0_224_9691" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="55" height="56">
                    <path d="M27.4999 55.4287C12.3749 55.4287 0.0712891 43.125 0.0712891 28.0001C0.0712891 12.8752 12.3749 0.571533 27.4999 0.571533C42.6248 0.571533 54.9284 12.8752 54.9284 28.0001C54.9284 43.125 42.6248 55.4287 27.4999 55.4287Z" fill="white" />
                  </mask>
                  <g mask="url(#mask0_224_9691)">
                    <path d="M27.4999 55.4287C12.3749 55.4287 0.0712891 43.125 0.0712891 28.0001C0.0712891 12.8752 12.3749 0.571533 27.4999 0.571533C42.6248 0.571533 54.9284 12.8752 54.9284 28.0001C54.9284 43.125 42.6248 55.4287 27.4999 55.4287Z" fill="#E7F1FE" />
                    <path opacity="0.5" fillRule="evenodd" clipRule="evenodd" d="M32.7994 31.9187H18.2784C12.5738 31.9187 7.90625 36.7063 7.90625 42.6051V49.2522C9.21312 50.3016 10.603 51.2185 12.0551 52.0092C16.0774 54.1914 20.6848 55.4289 25.5389 55.4289C30.3931 55.4289 34.9983 54.1914 39.0227 52.0092C40.4727 51.2185 41.8646 50.3016 43.1715 49.2522V42.6051C43.1715 36.7063 38.5248 31.9187 32.7994 31.9187Z" fill="url(#paint0_linear_224_9691)" />
                    <path opacity="0.5" fillRule="evenodd" clipRule="evenodd" d="M25.5378 9.71313C19.7909 9.71313 15.0889 14.3942 15.0889 20.1621C15.0889 25.93 19.7909 30.6111 25.5378 30.6111C31.3056 30.6111 35.9868 25.93 35.9868 20.1621C35.9868 14.3942 31.3056 9.71313 25.5378 9.71313Z" fill="url(#paint1_linear_224_9691)" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M26.8496 11.0208C21.4618 11.0208 17.0537 15.4093 17.0537 20.8167C17.0537 26.224 21.4618 30.6125 26.8496 30.6125C32.257 30.6125 36.6456 26.224 36.6456 20.8167C36.6456 15.4093 32.257 11.0208 26.8496 11.0208Z" fill="url(#paint2_linear_224_9691)" />
                    <path fillRule="evenodd" clipRule="evenodd" d="M34.3491 33.8762H20.6348C15.247 33.8762 10.8389 38.2648 10.8389 43.6722V49.7652C12.0732 50.7271 13.3858 51.5677 14.7572 52.2926C18.5561 54.2929 22.9074 55.4272 27.4919 55.4272C32.0764 55.4272 36.4258 54.2929 40.2266 52.2926C41.5961 51.5677 42.9106 50.7271 44.1449 49.7652V43.6722C44.1449 38.2648 39.7564 33.8762 34.3491 33.8762Z" fill="url(#paint3_linear_224_9691)" />
                  </g>
                </g>
                <defs>
                  <linearGradient id="paint0_linear_224_9691" x1="71.0299" y1="37.1067" x2="13.64" y2="56.0111" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0F71EF" />
                    <stop offset="1" stopColor="white" />
                  </linearGradient>
                  <linearGradient id="paint1_linear_224_9691" x1="49.2108" y1="25.9274" x2="19.6461" y2="18.01" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#858585" />
                    <stop offset="1" stopColor="white" />
                  </linearGradient>
                  <linearGradient id="paint2_linear_224_9691" x1="33.9429" y1="22.7948" x2="-0.159482" y2="11.0208" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0F71EF" />
                    <stop offset="1" stopColor="white" />
                  </linearGradient>
                  <linearGradient id="paint3_linear_224_9691" x1="14.1789" y1="48.5383" x2="38.6573" y2="29.0982" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#0F71EF" />
                    <stop offset="1" stopColor="white" />
                  </linearGradient>
                  <clipPath id="clip0_224_9691">
                    <rect width="54.8571" height="54.8571" fill="white" transform="translate(0.0712891 0.571533)" />
                  </clipPath>
                </defs>
              </svg>
            </div>
          )}
          <div className="camera-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M4.43274 2.61722C4.58839 1.85312 5.26834 1.3125 6.04736 1.3125H7.9533C8.73231 1.3125 9.41226 1.85312 9.56791 2.61722C9.60384 2.79361 9.76365 2.923 9.92983 2.923H9.93939L9.94894 2.92342C10.7676 2.95922 11.3964 3.05968 11.9214 3.40409C12.2522 3.62108 12.5367 3.90027 12.7584 4.22604C13.0343 4.63136 13.1559 5.09655 13.2142 5.65918C13.2712 6.20888 13.2712 6.89792 13.2712 7.77061V7.8203C13.2712 8.69299 13.2712 9.38203 13.2142 9.93173C13.1559 10.4944 13.0343 10.9596 12.7584 11.3649C12.5367 11.6906 12.2522 11.9698 11.9214 12.1868C11.5111 12.456 11.0406 12.5747 10.47 12.6317C9.91136 12.6875 9.21059 12.6875 8.32066 12.6875H5.67999C4.79006 12.6875 4.0893 12.6875 3.53064 12.6317C2.96004 12.5747 2.48959 12.456 2.07924 12.1868C1.74847 11.9698 1.46394 11.6906 1.24224 11.3649C0.966394 10.9596 0.844733 10.4944 0.786438 9.93173C0.729483 9.38203 0.729487 8.69299 0.729492 7.82029V7.77062C0.729487 6.89792 0.729483 6.20888 0.786438 5.65918C0.844733 5.09655 0.966394 4.63136 1.24224 4.22604C1.46394 3.90027 1.74847 3.62108 2.07924 3.40409C2.60422 3.05968 3.23304 2.95922 4.05171 2.92342L4.06126 2.923H4.07082C4.23701 2.923 4.39681 2.79361 4.43274 2.61722ZM6.04736 2.1875C5.67337 2.1875 5.36061 2.44591 5.29013 2.79187C5.176 3.35218 4.67924 3.79275 4.08152 3.79795C3.29483 3.83291 2.87345 3.92954 2.5592 4.1357C2.3238 4.29013 2.12221 4.48823 1.96561 4.71833C1.80452 4.95504 1.70772 5.25773 1.65678 5.74936C1.60504 6.24871 1.60449 6.89243 1.60449 7.79545C1.60449 8.69847 1.60504 9.3422 1.65678 9.84155C1.70772 10.3332 1.80452 10.6359 1.96561 10.8726C2.12221 11.1027 2.3238 11.3008 2.5592 11.4552C2.80276 11.615 3.11442 11.7108 3.6176 11.761C4.12769 11.812 4.78479 11.8125 5.70403 11.8125H8.29662C9.21587 11.8125 9.87296 11.812 10.3831 11.761C10.8862 11.7108 11.1979 11.615 11.4415 11.4552C11.6769 11.3008 11.8784 11.1027 12.035 10.8726C12.1961 10.6359 12.2929 10.3332 12.3439 9.84155C12.3956 9.3422 12.3962 8.69847 12.3962 7.79545C12.3962 6.89243 12.3956 6.24871 12.3439 5.74936C12.2929 5.25773 12.1961 4.95504 12.035 4.71833C11.8784 4.48823 11.6769 4.29013 11.4415 4.1357C11.1272 3.92954 10.7058 3.83291 9.91913 3.79795C9.32141 3.79275 8.82466 3.35218 8.71052 2.79187C8.64005 2.44591 8.32728 2.1875 7.9533 2.1875H6.04736ZM7.00033 6.27083C6.27545 6.27083 5.68783 6.85846 5.68783 7.58333C5.68783 8.30821 6.27545 8.89583 7.00033 8.89583C7.7252 8.89583 8.31283 8.30821 8.31283 7.58333C8.31283 6.85846 7.7252 6.27083 7.00033 6.27083ZM4.81283 7.58333C4.81283 6.37521 5.7922 5.39583 7.00033 5.39583C8.20845 5.39583 9.18783 6.37521 9.18783 7.58333C9.18783 8.79146 8.20845 9.77083 7.00033 9.77083C5.7922 9.77083 4.81283 8.79146 4.81283 7.58333ZM10.0628 5.83333C10.0628 5.59171 10.2587 5.39583 10.5003 5.39583H11.0837C11.3253 5.39583 11.5212 5.59171 11.5212 5.83333C11.5212 6.07496 11.3253 6.27083 11.0837 6.27083H10.5003C10.2587 6.27083 10.0628 6.07496 10.0628 5.83333Z" fill="white" />
            </svg>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />

        <div className="user-info">
          <p className="user-name">
            {getDisplayName()}
          </p>
          <p className="user-phone">
            {userData.phoneNumber ? formatPhoneNumber(userData.phoneNumber) : <FormattedMessage id="phoneNumber" />}
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <div className="profile-form">
        {/* First Name Field */}
        <div className="form-field">
          <div className="field-label-container">
            <label className="field-label">
              <FormattedMessage id="firstName" />
              <span className="required-star">*</span>
            </label>
          </div>
          <div className={`input-container ${userData.firstName ? 'filled' : ''}`}>
            <input
              type="text"
              placeholder={intl.formatMessage({ id: 'enterFirstName' })}
              value={userData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* Last Name Field */}
        <div className="form-field">
          <div className="field-label-container">
            <label className="field-label">
              <FormattedMessage id="lastName" />
              <span className="required-star">*</span>
            </label>
          </div>
          <div className={`input-container ${userData.lastName ? 'filled' : ''}`}>
            <input
              type="text"
              placeholder={intl.formatMessage({ id: 'enterLastName' })}
              value={userData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* Phone Number Field */}
        <div className="form-field">
          <div className="field-label-container">
            <label className="field-label">
              <FormattedMessage id="phoneNumber" />
            </label>
          </div>
          <div className={`input-container ${isValidPhoneNumber(userData.phoneNumber) ? 'valid' : ''}`}>
            <input
              type="tel"
              placeholder={intl.formatMessage({ id: 'enterPhoneNumber' })}
              value={userData.phoneNumber}
              onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
              className="form-input phone-input"
              dir="auto"
            />
            {isValidPhoneNumber(userData.phoneNumber) && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="validation-icon">
                <path fillRule="evenodd" clipRule="evenodd" d="M2.8146 4.23518C2.5 4.6834 2.5 6.01573 2.5 8.68038V9.99264C2.5 14.691 6.03247 16.9711 8.2488 17.9392C8.85001 18.2019 9.15062 18.3332 10 18.3332C10.8494 18.3332 11.15 18.2019 11.7512 17.9392C13.9675 16.9711 17.5 14.691 17.5 9.99264V8.68038C17.5 6.01573 17.5 4.6834 17.1854 4.23518C16.8708 3.78695 15.6181 3.35813 13.1126 2.5005L12.6352 2.3371C11.3292 1.89004 10.6762 1.6665 10 1.6665C9.32384 1.6665 8.67082 1.89004 7.36477 2.3371L6.88743 2.5005C4.38194 3.35813 3.12919 3.78695 2.8146 4.23518ZM12.5495 8.74943C12.7794 8.49195 12.7571 8.09685 12.4996 7.86696C12.2421 7.63707 11.847 7.65943 11.6171 7.91691L9.10714 10.7281L8.38288 9.91691C8.15298 9.65943 7.75789 9.63707 7.50041 9.86696C7.24293 10.0969 7.22056 10.4919 7.45046 10.7494L8.64093 12.0828C8.75951 12.2156 8.9291 12.2915 9.10714 12.2915C9.28518 12.2915 9.45478 12.2156 9.57335 12.0828L12.5495 8.74943Z" fill="#0F71EF" />
              </svg>
            )}
          </div>
        </div>

        {/* Province Field */}
        <div className="form-field">
          <div className="field-label-container">
            <label className="field-label">
              <FormattedMessage id="province" />
            </label>
          </div>
          <div className={`input-container dropdown-container ${userData.province ? 'filled' : ''}`}>
            <input
              type="text"
              placeholder={intl.formatMessage({ id: 'selectProvince' })}
              value={userData.province}
              onChange={(e) => handleInputChange('province', e.target.value)}
              onFocus={() => setShowProvinceDropdown(true)}
              className="form-input"
            />
            <button
              className="dropdown-arrow"
              onClick={() => setShowProvinceDropdown(!showProvinceDropdown)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6L8 10L12 6" stroke="#858585" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showProvinceDropdown && (
              <div className="dropdown-list">
                {provinces.map(province => (
                  <div
                    key={province.id}
                    className="dropdown-item"
                    onClick={() => handleProvinceSelect(province.name)}
                  >
                    {province.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* City Field */}
        <div className="form-field">
          <div className="field-label-container">
            <label className="field-label">
              <FormattedMessage id="city" />
            </label>
          </div>
          <div className={`input-container dropdown-container ${userData.city ? 'filled' : ''}`}>
            <input
              type="text"
              placeholder={intl.formatMessage({ id: 'selectCity' })}
              value={userData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              onFocus={() => userData.province && setShowCityDropdown(true)}
              className="form-input"
              disabled={!userData.province}
            />
            <button
              className="dropdown-arrow"
              onClick={() => userData.province && setShowCityDropdown(!showCityDropdown)}
              disabled={!userData.province}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6L8 10L12 6" stroke="#858585" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showCityDropdown && userData.province && (
              <div className="dropdown-list">
                {cities.map((city, index) => (
                  <div
                    key={index}
                    className="dropdown-item"
                    onClick={() => handleCitySelect(city)}
                  >
                    {city}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="submit-section">
        <button
          className={`submit-button ${isFormValid ? 'active' : ''}`}
          onClick={handleSubmit}
          disabled={!isFormValid}
        >
          <FormattedMessage id="confirmAndSave" />
        </button>
      </div>
    </div>
  );
}

export default ProfileInfo;