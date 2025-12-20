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

  // Sample rules data
  const rulesSections = [
    {
      id: 'terms',
      title: 'termsOfService',
      content: 'termsContent'
    },
    {
      id: 'privacy',
      title: 'privacyPolicy',
      content: 'privacyContent'
    },
    {
      id: 'usage',
      title: 'acceptableUse',
      content: 'usageContent'
    },
    {
      id: 'liability',
      title: 'liabilityLimitation',
      content: 'liabilityContent'
    },
    {
      id: 'account',
      title: 'accountRules',
      content: 'accountContent'
    }
  ];

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
          <p className="rules-section-description">
            <FormattedMessage id="rulesIntro" />
          </p>
        </div>

        {/* Rules Sections Accordion */}
        <div className="rules-accordion-container">
          {rulesSections.map((section) => (
            <div 
              key={section.id} 
              className={`rules-accordion-section ${rulesExpandedSections[section.id] ? 'rules-expanded' : ''}`}
            >
              <div 
                className="rules-accordion-header"
                onClick={() => rulesToggleSection(section.id)}
              >
                <div className="rules-accordion-header-left">
                  <div className="rules-section-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 15V12M12 12V9M12 12H15M12 12H9M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                        stroke="currentColor" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <h3 className="rules-accordion-title">
                    <FormattedMessage id={section.title} />
                  </h3>
                </div>
                <div className="rules-accordion-arrow">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 6L8 10L12 6" 
                      stroke="currentColor" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              
              <div className="rules-accordion-content">
                <p>
                  <FormattedMessage id={section.content} />
                </p>
                
                {/* Sample bullet points for some sections */}
                {section.id === 'usage' && (
                  <ul className="rules-list-items">
                    <li><FormattedMessage id="rulePoint1" /></li>
                    <li><FormattedMessage id="rulePoint2" /></li>
                    <li><FormattedMessage id="rulePoint3" /></li>
                    <li><FormattedMessage id="rulePoint4" /></li>
                  </ul>
                )}
                
                {section.id === 'account' && (
                  <div className="rules-important-note">
                    <div className="rules-note-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 13H10.01M10 7V10M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" 
                          stroke="currentColor" 
                          strokeWidth="1.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <p><FormattedMessage id="importantNote" /></p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Agreement Section */}
        <div className="rules-agreement-section">
          <div className="rules-agreement-checkbox">
            <input type="checkbox" id="rulesAgreeTerms" />
            <label htmlFor="rulesAgreeTerms">
              <FormattedMessage id="agreeTerms" />
            </label>
          </div>
          
          <p className="rules-agreement-note">
            <FormattedMessage id="agreementNote" />
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