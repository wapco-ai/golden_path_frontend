import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import logo from '../assets/images/logo.png';
import '../styles/Rules.css';

function Rules() {
  const navigate = useNavigate();
  const intl = useIntl();
  const [rulesShowHeaderText, setRulesShowHeaderText] = useState(false);
  const [rulesExpandedSections, setRulesExpandedSections] = useState({});

  useEffect(() => {

    window.scrollTo(0, 0);


    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;


    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = 'auto';
    }, 10);
  }, [location.pathname]);

  // Show header text with fade-in, then fade out
  useEffect(() => {
    setRulesShowHeaderText(true);

    const timer = setTimeout(() => {
      setRulesShowHeaderText(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const rulesToggleSection = (sectionId) => {
    setRulesExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };


  return (
    <div className="rules-page-container">
      {/* Header with Back Arrow */}
      <div className="rules-page-header">
        <button className="rules-back-arrow" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.33301 10H16.6663M16.6663 10L11.6663 5M16.6663 10L11.6663 15" stroke="#1E2023" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="rules-section-title">
          <FormattedMessage id="termsRegulation" />
        </h2>
      </div>

      {/* Main Content */}
      <div className="rules-page-content">
        {/* Introduction Section */}
        <div className="rules-intro-section">
          <div className="rules-description-header">
            <div className="intro-line3">
              <div className="line left-line3"></div>
              <div className="rules-logo-container">
                <img
                  src={logo}
                  alt={intl.formatMessage({ id: 'logoAlt' })}
                  className="rules-logo"
                />
              </div>
              <div className="line right-line3"></div>
            </div>
          </div>
          <p className="rules-section-description">
            <FormattedMessage id="rulesIntro" />
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="rules-page-footer">
        <img src={logo} alt={intl.formatMessage({ id: 'logoAlt' })} className="rules-footer-logo" />
        <p className="rules-footer-text">
          <FormattedMessage id="rulesFooter" />
        </p>
      </div>
    </div>
  );
}

export default Rules;