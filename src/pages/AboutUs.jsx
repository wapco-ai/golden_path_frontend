import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateToPreviousPage } from '../utils/navigationHistory';
import { FormattedMessage, useIntl } from 'react-intl';
import logo from '../assets/images/logo.png';
import '../styles/AboutUs.css';
import { fetchAboutPage } from '../services/publicPagesService';
import { useLangStore } from '../store/langStore';

function AboutUs() {
  const navigate = useNavigate();
  const intl = useIntl();
  const language = useLangStore((state) => state.language);
  const [aboutContent, setAboutContent] = useState(null);

  useEffect(() => {

    if (location.pathname.includes('/edit-cultural') || 
        location.pathname.includes('edit-cultural-info') ||
        isEditingCultural) {
      
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      

      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        document.body.style.overflow = 'auto';
      }, 10);
    }
  }, [location.pathname, isEditingCultural]);

  useEffect(() => {
    let isMounted = true;

    const loadAboutContent = async () => {
      try {
        const data = await fetchAboutPage(language);
        if (isMounted) {
          setAboutContent(data);
        }
      } catch (error) {
        if (isMounted) {
          setAboutContent(null);
        }
      }
    };

    loadAboutContent();

    return () => {
      isMounted = false;
    };
  }, [language]);

  return (
    <div className="aboutus-page-container">
      {/* Header with Back Arrow */}
      <div className="aboutus-header">
        <button className="aboutus-back-arrow" onClick={() => navigateToPreviousPage(navigate)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.33301 10H16.6663M16.6663 10L11.6663 5M16.6663 10L11.6663 15" stroke="#1E2023" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h1 className="aboutus-title">
          {aboutContent?.title || <FormattedMessage id="aboutUsTitle" />}
        </h1>
      </div>

      {/* Main Content */}
      <div className="aboutus-content">

        {/* Main Description Box */}
        <div className="aboutus-description-box">
          <div className="aboutus-description-header">
            <div className="aboutus-logo-container">
              <img
                src={logo}
                alt={intl.formatMessage({ id: 'logoAlt' })}
                className="aboutus-logo"
              />
            </div>
            <div className="intro-line">
              <div className="line left-line"></div>
              <div className="circle"></div>
              <div className="line right-line"></div>
            </div>
          </div>

          <div className="aboutus-description-content">
            <p className="aboutus-description-text">
              {aboutContent?.description || <FormattedMessage id="aboutDescription" />}
            </p>
          </div>
        </div>

        {/* Contact Call-to-Action */}
        <div className="aboutus-cta-section">
          <h3 className="aboutus-cta-title">
            <FormattedMessage id="haveQuestions" />
          </h3>
          <p className="aboutus-cta-description">
            <FormattedMessage id="contactUsDesc" />
          </p>
          <button
            className="aboutus-cta-button"
            onClick={() => navigate('/contactus')}
          >
            <FormattedMessage id="contactUs" />
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.16699 10H15.8337M15.8337 10L10.8337 5M15.8337 10L10.8337 15" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="aboutus-footer">
        <p className="aboutus-footer-text">
          <FormattedMessage id="aboutFooter" />
        </p>
      </div>
    </div>
  );
}

export default AboutUs;
