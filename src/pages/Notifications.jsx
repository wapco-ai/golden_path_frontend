import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateToPreviousPage } from '../utils/navigationHistory';
import { FormattedMessage, useIntl } from 'react-intl';
import '../styles/Notifications.css';

function Notifications() {
  const navigate = useNavigate();
  const intl = useIntl();

  useEffect(() => {

    window.scrollTo(0, 0);


    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;


    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = 'auto';
    }, 10);
  }, [location.pathname]);

  // Sample notifications data
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      type: 'appUpdate',
      title: 'appUpdateTitle',
      description: 'appUpdateDesc',
      date: '۲۳ شهریور ۱۴۰۴',
      time: '۱۰:۱۵',
      read: false,
      icon: '🔄'
    },
    {
      id: 2,
      type: 'review',
      title: 'reviewTitle',
      description: 'reviewDesc',
      date: '۲۲ شهریور ۱۴۰۴',
      time: '۱۶:۴۵',
      read: true,
      icon: '⭐'
    },
    {
      id: 3,
      type: 'gpsUpdate',
      title: 'gpsUpdateTitle',
      description: 'gpsUpdateDesc',
      date: '۲۱ شهریور ۱۴۰۴',
      time: '۱۱:۲۰',
      read: true,
      icon: '📍'
    },
    {
      id: 4,
      type: 'suggestion',
      title: 'suggestionTitle',
      description: 'suggestionDesc',
      date: '۲۰ شهریور ۱۴۰۴',
      time: '۰۹:۱۰',
      read: true,
      icon: '💡'
    },
    {
      id: 5,
      type: 'system',
      title: 'systemTitle',
      description: 'systemDesc',
      date: '۱۹ شهریور ۱۴۰۴',
      time: '۱۵:۳۰',
      read: false,
      icon: '⚙️'
    }
  ]);

  const [showMenu, setShowMenu] = useState(false);
  const [isRTL, setIsRTL] = useState(true); // Default to RTL for Persian

  // Check language direction
  useEffect(() => {
    const currentLang = localStorage.getItem('appLang') || 'fa';
    setIsRTL(['fa', 'ar'].includes(currentLang));
  }, []);

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
    setShowMenu(false);
  };

  // Mark single as read
  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  // Get unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  // Handle back
  const handleBack = () => {
    navigateToPreviousPage(navigate);
  };

  // Get type label
  const getTypeLabel = (type) => {
    switch (type) {
      case 'bloodDonation': return <FormattedMessage id="bloodDonation" />;
      case 'gps': return <FormattedMessage id="gpsUpdate" />;
      case 'road': return <FormattedMessage id="roadInfo" />;
      case 'shelter': return <FormattedMessage id="shelter" />;
      case 'newYear': return <FormattedMessage id="holiday" />;
      case 'radio': return <FormattedMessage id="radio" />;
      default: return <FormattedMessage id="general" />;
    }
  };

  return (
    <div className={`notifications-container ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Header */}
      <div className="notifications-header">
        <button className="back-button-notifs" onClick={handleBack} aria-label={intl.formatMessage({ id: 'back' })}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.33301 10H16.6663M16.6663 10L11.6663 5M16.6663 10L11.6663 15" stroke="#1E2023" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="page-title-notifs">
          <FormattedMessage id="notifications" />
        </h1>

        <div className="header-right">
          <button
            className="menu-button"
            onClick={() => setShowMenu(!showMenu)}
            aria-label={intl.formatMessage({ id: 'options' })}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="6" r="2" fill="#1E2023" />
              <circle cx="12" cy="12" r="2" fill="#1E2023" />
              <circle cx="12" cy="18" r="2" fill="#1E2023" />
            </svg>
          </button>

          {showMenu && (
            <div className="dropdown-menu">
              <button
                className="menu-item"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 4.5L6.75 12.75L3 9" stroke={unreadCount === 0 ? "#858585" : "#0F71EF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{color: unreadCount === 0 ? "#858585" : "#0F71EF"}}><FormattedMessage id="markAllAsRead" /></span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="notifications-list-t">
        {notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="30" stroke="#E0E0E0" strokeWidth="2" />
                <path d="M32 20V36M32 44H32.02" stroke="#E0E0E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="empty-title">
              <FormattedMessage id="noNotifications" />
            </h3>
            <p className="empty-description">
              <FormattedMessage id="noNotificationsDesc" />
            </p>
          </div>
        ) : (
          <div className="notifications-column">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`notification-card ${notification.read ? 'read' : 'unread'}`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="notification-icon">
                  {notification.icon}
                </div>

                <div className="notification-content">
                  <div className="notification-header">
                    <h3 className="notification-title">
                      <FormattedMessage id={notification.title} />
                    </h3>
                    {!notification.read && (
                      <div className="unread-indicator">
                        <div className="pulse-dot"></div>
                        <div className="static-dot"></div>
                      </div>
                    )}
                  </div>

                  <p className="notification-description">
                    <FormattedMessage id={notification.description} />
                  </p>

                  <div className="notification-footer">
                    <div className="footer-left">
                      <span className="notification-date">{notification.date}</span>
                      <span className="notification-time">{notification.time}</span>
                    </div>
                    <div className="footer-right">
                      <span className="notification-type">
                        {getTypeLabel(notification.type)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Notifications;