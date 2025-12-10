import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import '../styles/Proutes.css';

function Proutes() {
  const navigate = useNavigate();
  const intl = useIntl();

  // State for routes data - initially empty to show "no routes" message
  const [routes, setRoutes] = useState([]);

  // Sample data for demonstration - remove this to show empty state
  const sampleRoutes = [
    {
      id: 1,
      date: 'یکشنبه 17 فروردین 1۴۰۴',
      time: '۱۳:۱۶',
      type: 'walking',
      distance: '۷۰۰ ',
      origin: 'میدان باب الحوائج علیه السلام',
      destination: 'صحن انقلاب اسلامی',
      mapData: null // Placeholder for future map integration
    },
    {
      id: 2,
      date: 'شنبه 16 فروردین 1۴۰۴',
      time: '۲۳:۲۴',
      type: 'walking',
      distance: '۸۰۰',
      origin: 'میدان باب الحوائج علیه السلام',
      destination: 'صحن آزادی',
      mapData: null
    }
  ];

  // Use sample data for demonstration - set to empty array to show "no routes" state
  const displayRoutes = sampleRoutes; // Change to [] to show empty state

  return (
    <div className="proute-container">
      {/* Header with Back Arrow */}
      <div className="proute-header">
        <button className="back-arrow5" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M11.2244 4.55806C11.4685 4.31398 11.8642 4.31398 12.1083 4.55806L17.1083 9.55806C17.3524 9.80214 17.3524 10.1979 17.1083 10.4419L12.1083 15.4419C11.8642 15.686 11.4685 15.686 11.2244 15.4419C10.9803 15.1979 10.9803 14.8021 11.2244 14.5581L15.1575 10.625H3.33301C2.98783 10.625 2.70801 10.3452 2.70801 10C2.70801 9.65482 2.98783 9.375 3.33301 9.375H15.1575L11.2244 5.44194C10.9803 5.19786 10.9803 4.80214 11.2244 4.55806Z" fill="black" />
          </svg>
        </button>
        <h1 className="proute-title">
          <FormattedMessage id="myRoutesTitle" />
        </h1>
      </div>

      {/* Routes List or Empty State */}
      <div className="proute-content">
        {displayRoutes.length === 0 ? (
          // Empty State
          <div className="empty-routes">
            <div className="empty-icon">
              <svg width="40" height="40" viewBox="0 0 22 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M4.58301 3.021C3.44392 3.021 2.52051 3.94441 2.52051 5.0835C2.52051 6.22258 3.44392 7.146 4.58301 7.146C5.72209 7.146 6.64551 6.22258 6.64551 5.0835C6.64551 3.94441 5.72209 3.021 4.58301 3.021ZM1.14551 5.0835C1.14551 3.18502 2.68453 1.646 4.58301 1.646C6.48149 1.646 8.02051 3.18502 8.02051 5.0835C8.02051 6.98197 6.48149 8.521 4.58301 8.521C2.68453 8.521 1.14551 6.98197 1.14551 5.0835ZM9.39551 5.0835C9.39551 4.7038 9.70331 4.396 10.083 4.396H14.7872C17.3092 4.396 18.2683 7.68958 16.1406 9.04356L6.59695 15.1168C5.62982 15.7322 6.06578 17.2293 7.21211 17.2293H10.2566L10.0552 17.028C9.78672 16.7595 9.78672 16.3242 10.0552 16.0557C10.3237 15.7872 10.759 15.7872 11.0275 16.0557L12.4025 17.4307C12.671 17.6992 12.671 18.1345 12.4025 18.403L11.0275 19.778C10.759 20.0464 10.3237 20.0464 10.0552 19.778C9.78672 19.5095 9.78672 19.0742 10.0552 18.8057L10.2566 18.6043H7.21211C4.69014 18.6043 3.73107 15.3107 5.85875 13.9568L15.4024 7.88352C16.3695 7.26808 15.9336 5.771 14.7872 5.771H10.083C9.70331 5.771 9.39551 5.46319 9.39551 5.0835ZM17.4163 15.8543C16.2773 15.8543 15.3538 16.7777 15.3538 17.9168C15.3538 19.0559 16.2773 19.9793 17.4163 19.9793C18.5554 19.9793 19.4788 19.0559 19.4788 17.9168C19.4788 16.7777 18.5554 15.8543 17.4163 15.8543ZM13.9788 17.9168C13.9788 16.0183 15.5179 14.4793 17.4163 14.4793C19.3148 14.4793 20.8538 16.0183 20.8538 17.9168C20.8538 19.8153 19.3148 21.3543 17.4163 21.3543C15.5179 21.3543 13.9788 19.8153 13.9788 17.9168Z" fill="#1E2023" />
              </svg>
            </div>
            <p className="empty-text">
              <FormattedMessage id="noRoutesMessage" />
            </p>
          </div>
        ) : (
          // Routes List
          <div className="routes-list">
            {displayRoutes.map((route) => (
              <div key={route.id} className="route-card">
                {/* Map Container - Placeholder for future map integration */}
                <div className="route-map">
                  <div className="map-placeholder">
                  </div>
                </div>

                {/* Route Details */}
                <div className="route-details">
                  {/* Date and Time */}
                  <div className="route-date-time">
                    <span className="route-date">{route.date}</span>
                    <span className="place-meta-separator5">.</span>
                    <span className="route-time">{route.time}</span>
                  </div>

                  {/* Transportation Type and Distance */}
                  <div className="route-metrics">
                    <div className="metric-item">
                      <span className="metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M9.33344 3.00016C9.33344 3.92064 8.58725 4.66683 7.66677 4.66683C6.7463 4.66683 6.00011 3.92064 6.00011 3.00016C6.00011 2.07969 6.7463 1.3335 7.66677 1.3335C8.58725 1.3335 9.33344 2.07969 9.33344 3.00016Z" fill="#1E2023" />
                          <path fillRule="evenodd" clipRule="evenodd" d="M8.352 7.16896C8.3266 7.16714 8.29479 7.16683 8.18 7.16683H7.4526L7.39183 7.77451C7.2758 8.93479 7.23546 9.40102 7.33911 9.8422C7.44276 10.2834 7.68652 10.6828 8.3071 11.6701L10.0237 14.4007C10.1706 14.6345 10.1003 14.9432 9.86647 15.0901C9.63268 15.2371 9.32402 15.1667 9.17706 14.9329L7.46049 12.2023C7.44415 12.1763 7.428 12.1506 7.41202 12.1252C6.85545 11.2401 6.51201 10.694 6.36562 10.0709C6.21923 9.44786 6.28353 8.80592 6.38773 7.76561C6.39072 7.73574 6.39374 7.70554 6.3968 7.67501L6.44755 7.16745C6.11344 7.16916 5.86628 7.17563 5.66674 7.19985C5.41526 7.23037 5.29798 7.28348 5.2149 7.35013C5.13182 7.41677 5.05452 7.51974 4.97018 7.75861C4.88129 8.01033 4.80475 8.35084 4.69083 8.86348L4.4882 9.77529C4.4283 10.0449 4.16121 10.2148 3.89164 10.1549C3.62208 10.095 3.45211 9.82793 3.51201 9.55836L3.72115 8.61726C3.82681 8.14169 3.91577 7.74134 4.02723 7.42565C4.14552 7.09066 4.30664 6.79672 4.58917 6.57009C4.87169 6.34345 5.19359 6.24993 5.54626 6.20713C5.87861 6.1668 6.28872 6.16681 6.77589 6.16683L8.18 6.16683C8.18556 6.16683 8.19104 6.16683 8.19644 6.16683C8.28715 6.16681 8.35761 6.1668 8.42352 6.17152C9.16617 6.22477 9.80287 6.72189 10.0346 7.42946C10.0552 7.49225 10.0723 7.56062 10.0943 7.64862L10.0983 7.66456C10.1357 7.81422 10.1468 7.85672 10.1571 7.8864C10.2973 8.29044 10.7205 8.52279 11.1367 8.42412C11.1672 8.41687 11.2091 8.40346 11.3554 8.35468L11.842 8.19249C12.104 8.10516 12.3871 8.24674 12.4744 8.50871C12.5618 8.77069 12.4202 9.05385 12.1582 9.14117L11.6717 9.30336C11.6643 9.3058 11.6571 9.3082 11.65 9.31057C11.5354 9.34882 11.4473 9.37819 11.3674 9.39714C10.4519 9.61421 9.52072 9.10304 9.21235 8.21415C9.18542 8.13652 9.16293 8.04648 9.13364 7.92921C9.13183 7.92194 9.12999 7.91457 9.12812 7.9071C9.10028 7.79573 9.09226 7.76495 9.08433 7.74075C8.97898 7.41913 8.68957 7.19317 8.352 7.16896ZM6.27746 11.2508C6.50722 11.404 6.56931 11.7144 6.41613 11.9442L4.41613 14.9442C4.26296 15.1739 3.95252 15.236 3.72276 15.0829C3.49299 14.9297 3.43091 14.6192 3.58408 14.3895L5.58408 11.3895C5.73726 11.1597 6.04769 11.0976 6.27746 11.2508Z" fill="#1E2023" />
                        </svg>
                      </span>
                      <span className="metric-text">
                        <FormattedMessage id="routemode" />
                      </span>
                      <span className="metric-text">
                        <FormattedMessage id="transportWalk" />
                      </span>
                    </div>
                    <div className="metric-item">
                      <span className="metric-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="3.33301" cy="3.3335" r="2" fill="#1E2023" />
                          <circle cx="12.667" cy="12.6665" r="2" fill="#1E2023" />
                          <path fillRule="evenodd" clipRule="evenodd" d="M6.83372 3.3335C6.83372 3.05735 7.05758 2.8335 7.33372 2.8335H10.755C12.5891 2.8335 13.2867 5.22883 11.7393 6.21354L4.79841 10.6304C4.09504 11.078 4.4121 12.1668 5.2458 12.1668H7.45995L7.3135 12.0204C7.11824 11.8251 7.11824 11.5085 7.3135 11.3133C7.50877 11.118 7.82535 11.118 8.02061 11.3133L9.02061 12.3133C9.21587 12.5085 9.21587 12.8251 9.02061 13.0204L8.02061 14.0204C7.82535 14.2156 7.50877 14.2156 7.3135 14.0204C7.11824 13.8251 7.11824 13.5085 7.3135 13.3133L7.45995 13.1668H5.2458C3.41164 13.1668 2.71413 10.7715 4.26153 9.78678L11.2024 5.36988C11.9057 4.92228 11.5887 3.8335 10.755 3.8335H7.33372C7.05758 3.8335 6.83372 3.60964 6.83372 3.3335Z" fill="#1E2023" />
                        </svg>
                      </span>
                      <span className="metric-text"> <FormattedMessage id="distance" /> </span>
                      <span className="metric-text">{route.distance} <FormattedMessage id="meter" /></span>
                    </div>
                  </div>

                  {/* Origin and Destination */}
                  <div className="route-locations">
                    <div className="location-item">
                      <span className="location-icon8 origin">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="6" cy="6" r="4.5" transform="matrix(-1 0 0 1 12 0)" fill="white" stroke="#0F71EF" strokeWidth="3" />
                        </svg>
                      </span>
                      <span><FormattedMessage id="origin" /> :</span>
                      <span className="location-text8">{route.origin}</span>
                    </div>
                    <div className="location-item2">
                      <span className="location-icon9">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#e0e0e0"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="icon icon-tabler icons-tabler-outline icon-tabler-dots-vertical"
                        >
                          <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                          <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                          <path d="M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                          <path d="M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                        </svg>
                      </span>
                    </div>
                    <div className="location-item">
                      <span className="location-icon8 destination">
                        <svg width="12" height="15" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path fillRule="evenodd" clipRule="evenodd" d="M6 0C2.68629 0 0 3.00194 0 6.375C0 9.72163 1.91499 13.3593 4.9028 14.7558C5.59931 15.0814 6.40069 15.0814 7.0972 14.7558C10.085 13.3593 12 9.72163 12 6.375C12 3.00194 9.31371 0 6 0ZM6 7.5C6.82843 7.5 7.5 6.82843 7.5 6C7.5 5.17157 6.82843 4.5 6 4.5C5.17157 4.5 4.5 5.17157 4.5 6C4.5 6.82843 5.17157 7.5 6 7.5Z" fill="#EA4335" />
                        </svg>
                      </span>
                      <span ><FormattedMessage id="destination" /> :</span>
                      <span className="location-text8">{route.destination}</span>
                    </div>
                  </div>
                  <div className="btn-container3">
                    <button className="repeat-route-btn">

                      <FormattedMessage id="repeatRoute" />
                    </button>
                    <button className="repeat-prev-btn">

                      <FormattedMessage id="showPrevRoute" />
                    </button>
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

export default Proutes;