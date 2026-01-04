import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import '../styles/Pfp.css';
import { USER_ACCESS_TOKEN_KEY, useUserAuthStore } from '../auth/user/userAuthStore';
import { listDestinations } from '../services/destinationService';

function Pfp() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { accessToken, user } = useUserAuthStore();

  const [savedLocations, setSavedLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isUserLoggedIn = Boolean(
    accessToken ||
    user ||
    (typeof window !== 'undefined' && window.sessionStorage?.getItem?.(USER_ACCESS_TOKEN_KEY))
  );

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadDestinations = async () => {
      if (!isUserLoggedIn) {
        setSavedLocations([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await listDestinations({ signal: controller.signal, pageSize: 50 });
        if (!isMounted) return;
        setSavedLocations(data?.items || []);
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (!isMounted) return;
        setError(err?.message || intl.formatMessage({ id: 'generalErrorMessage' }));
        setSavedLocations([]);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    };

    loadDestinations();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [intl, isUserLoggedIn]);

  return (
    <div className="pfp-container">
      {/* Header Section */}
      <div className="pfp-header">
        <button className="back-arrow5 " onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.33301 10H16.6663M16.6663 10L11.6663 5M16.6663 10L11.6663 15" stroke="#1E2023" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h1 className="pfp-title ">
          <FormattedMessage id="savedLocationsTitle" />
        </h1>

      </div>

      {/* Content Section */}
      <div className="pfp-content">
        {isLoading ? (
          <div className="empty-state">
            <h2 className="empty-title">
              <FormattedMessage id="loading" />
            </h2>
          </div>
        ) : !isUserLoggedIn ? (
          <div className="empty-state">
            <h2 className="empty-title">
              <FormattedMessage id="noSavedLocationsTitle" />
            </h2>

            <p className="empty-description">
              <FormattedMessage id="loginToEnableActions" />
            </p>

            <button className="add-location-btn" onClick={() => navigate('/login')}>
              <FormattedMessage id="login" />
            </button>
          </div>
        ) : error ? (
          <div className="empty-state">
            <h2 className="empty-title">{error}</h2>
            <p className="empty-description">
              <FormattedMessage id="generalErrorMessage" />
            </p>
            <button className="add-location-btn" onClick={() => navigate('/pmap')}>
              <FormattedMessage id="addLocationButton" />
            </button>
          </div>
        ) : savedLocations.length === 0 ? (
          // Empty state when no locations are saved (First screenshot)
          <div className="empty-state">
            <div className="empty-icon3">
              <svg width="57" height="56" viewBox="0 0 57 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M49.5 25.894V37.5453C49.5 44.7706 49.5 48.3833 47.7871 49.9619C46.9702 50.7147 45.939 51.1877 44.8405 51.3134C42.5373 51.577 39.8476 49.198 34.4683 44.4401C32.0905 42.337 30.9016 41.2854 29.526 41.0083C28.8487 40.8719 28.1513 40.8719 27.474 41.0083C26.0984 41.2854 24.9095 42.337 22.5317 44.4401C17.1524 49.198 14.4627 51.577 12.1595 51.3134C11.061 51.1877 10.0298 50.7147 9.21291 49.9619C7.5 48.3833 7.5 44.7706 7.5 37.5453V25.894C7.5 15.8873 7.5 10.8839 10.5754 7.77521C13.6508 4.6665 18.6005 4.6665 28.5 4.6665C38.3995 4.6665 43.3492 4.6665 46.4246 7.77521C49.5 10.8839 49.5 15.8873 49.5 25.894ZM19.75 13.9998C19.75 13.0333 20.5335 12.2498 21.5 12.2498H35.5C36.4665 12.2498 37.25 13.0333 37.25 13.9998C37.25 14.9663 36.4665 15.7498 35.5 15.7498H21.5C20.5335 15.7498 19.75 14.9663 19.75 13.9998Z" fill="black" />
              </svg>
            </div>

            <h2 className="empty-title">
              <FormattedMessage id="noSavedLocationsTitle" />
            </h2>

            <p className="empty-description">
              <FormattedMessage id="noSavedLocationsDescription" />
            </p>

            <button className="add-location-btn" onClick={() => navigate('/pmap')}>
              <FormattedMessage id="addLocationButton" />
            </button>
          </div>
        ) : (
          // List of saved locations (Second screenshot)
          <div className="locations-section">
            <div className="locations-list">
              {savedLocations.map((location) => (
                <div key={location.id} className="location-card">
                  <div className="location-info">
                    <div className="location-favorite-icon">
                      <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="32" height="32" rx="16" fill="#E7F1FE" />
                        <path d="M14.3397 12.155C15.0785 10.8295 15.448 10.1667 16.0003 10.1667C16.5527 10.1667 16.9221 10.8295 17.661 12.155L17.8521 12.4979C18.0621 12.8745 18.1671 13.0629 18.3308 13.1871C18.4945 13.3114 18.6983 13.3575 19.1061 13.4498L19.4773 13.5338C20.9121 13.8584 21.6295 14.0207 21.8002 14.5696C21.9708 15.1185 21.4818 15.6904 20.5036 16.8342L20.2505 17.1301C19.9726 17.4552 19.8336 17.6177 19.7711 17.8187C19.7085 18.0198 19.7296 18.2366 19.7716 18.6703L19.8098 19.0651C19.9577 20.5913 20.0317 21.3543 19.5848 21.6935C19.138 22.0328 18.4663 21.7235 17.1228 21.1049L16.7753 20.9449C16.3935 20.7691 16.2027 20.6812 16.0003 20.6812C15.798 20.6812 15.6071 20.7691 15.2254 20.9449L14.8778 21.1049C13.5344 21.7235 12.8627 22.0328 12.4158 21.6935C11.969 21.3543 12.0429 20.5913 12.1908 19.0651L12.2291 18.6703C12.2711 18.2366 12.2921 18.0198 12.2296 17.8187C12.1671 17.6177 12.0281 17.4552 11.7501 17.1301L11.497 16.8342C10.5189 15.6904 10.0298 15.1185 10.2005 14.5696C10.3712 14.0207 11.0886 13.8584 12.5234 13.5338L12.8946 13.4498C13.3023 13.3575 13.5062 13.3114 13.6699 13.1871C13.8336 13.0629 13.9385 12.8745 14.1485 12.4979L14.3397 12.155Z" fill="#0F71EF" />
                      </svg>
                    </div>

                    <div className="location-details">
                      <h3 className="location-name">{location.title || location.name}</h3>
                      <p className="location-address">{location.address || location.description || ''}</p>
                    </div>
                  </div>

                  <button className="location-options-btn">
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.00033 11.3333C8.73671 11.3333 9.33366 11.9303 9.33366 12.6667C9.33366 13.403 8.73671 14 8.00033 14C7.26395 14 6.66699 13.403 6.66699 12.6667C6.66699 11.9303 7.26395 11.3333 8.00033 11.3333Z" fill="#1E2023" />
                      <path d="M8.00033 6.66667C8.73671 6.66667 9.33366 7.26362 9.33366 8C9.33366 8.73638 8.73671 9.33333 8.00033 9.33333C7.26395 9.33333 6.66699 8.73638 6.66699 8C6.66699 7.26362 7.26395 6.66667 8.00033 6.66667Z" fill="#1E2023" />
                      <path d="M8.00033 2C8.73671 2 9.33366 2.59695 9.33366 3.33333C9.33366 4.06971 8.73671 4.66667 8.00033 4.66667C7.26395 4.66667 6.66699 4.06971 6.66699 3.33333C6.66699 2.59695 7.26395 2 8.00033 2Z" fill="#1E2023" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
                  <div className="add-location-section">
                    <button
                      className="add-location-button"
                      onClick={() => navigate('/pmap')}
                    >
                      <FormattedMessage id="addLocationButton2" />
                    </button>
                  </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Pfp;