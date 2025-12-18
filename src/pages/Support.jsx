import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import headerpic from '../assets/images/header.jpg';
import logo from '../assets/images/logo.png';
import '../styles/Support.css';
import { useLocation } from 'react-router-dom';

function Support() {
  const navigate = useNavigate();
  const intl = useIntl();
  const [showHeaderText, setShowHeaderText] = useState(true);
  const [feedbackSubject, setFeedbackSubject] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const location = useLocation();


  useEffect(() => {

    window.scrollTo(0, 0);


    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Force a reflow
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = 'auto';
    }, 10);
  }, [location.pathname]);

  useEffect(() => {
    setShowHeaderText(true);

    const timer = setTimeout(() => {
      setShowHeaderText(false);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleContactClick = (type) => {
    if (type === 'support') {
      window.location.href = 'mailto:support@example.com';
    } else if (type === 'phone') {
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        window.location.href = 'tel:+982112345678';
      } else {
        // For desktop, copy to clipboard or show number
        navigator.clipboard.writeText('+98 21 1234 5678')
          .then(() => {
            alert(intl.formatMessage({ id: 'phoneCopied' }));
          })
          .catch(() => {
            alert('Phone: +98 21 1234 5678');
          });
      }
    }
  };

  const handleFeedbackSubmit = () => {
    // Basic validation
    if (!feedbackSubject.trim() || !feedbackMessage.trim()) {
      alert(intl.formatMessage({ id: 'fillAllFields' }));
      return;
    }

    setIsSubmitting(true);

    // Simulate API call delay
    setTimeout(() => {
      // Reset form fields - THIS IS THE KEY PART
      setFeedbackSubject('');
      setFeedbackMessage('');
      setIsSubmitting(false);

      // Show success message
      setShowSuccessMessage(true);

      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);

      // Scroll to top to show the message
      window.scrollTo({ top: 0, behavior: 'smooth' });

    }, 1000); // Simulate 1 second API delay
  };

  return (
    <div className="support-container">
      {/* Header with Back Arrow */}
      <div className="support-header">
        <button className="back-arrow-support" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.33301 10H16.6663M16.6663 10L11.6663 5M16.6663 10L11.6663 15" stroke="#1E2023" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {/* Header Image Section */}
        <div className="header-image-container3">
          <img
            src={headerpic}
            alt={intl.formatMessage({ id: 'supportHeaderAlt' })}
            className="header-image"
          />

          {/* Animated Text Overlay */}
          {/* Static Overlay */}
          <div className="header-permanent-overlay"></div>

          {/* Animated Text Only */}
          {showHeaderText && (
            <div className="header-text-animated">
              <h2 className="header-main-text">
                <FormattedMessage id="howCanWeHelp" />
              </h2>
            </div>
          )}

        </div>
        {/* Success Message */}
        <div className={`success-message-container ${showSuccessMessage ? 'show' : ''}`}>
          <div className="success-message">
            <div className="success-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M22 4L12 14.01L9 11.01"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="success-content">
              <h3 className="success-title">
                <FormattedMessage id="feedbackSuccessTitle" />
              </h3>
              <p className="success-description">
                <FormattedMessage id="feedbackSuccessMessage" />
              </p>
            </div>
            <button
              className="close-success-btn"
              onClick={() => setShowSuccessMessage(false)}
              aria-label={intl.formatMessage({ id: 'close' })}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

      </div>

      {/* Main Content */}
      <div className="support-content">
        {/* Contact Section */}
        <div className="support-section">
          <h2 className="section-title">
            <FormattedMessage id="contactSupport" />
          </h2>
          <p className="section-description">
            <FormattedMessage id="contactDescription" />
          </p>

          <div className="contact-cards">
            <div className="contact-card" onClick={() => handleContactClick('phone')}>
              <div className="contact-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 16.92V19.92C22.0006 20.1985 21.9432 20.4737 21.8316 20.728C21.7201 20.9823 21.5568 21.2102 21.352 21.3974C21.1473 21.5846 20.9056 21.7272 20.6423 21.8163C20.3789 21.9053 20.0996 21.9389 19.822 21.915C16.7444 21.5689 13.7868 20.4894 11.186 18.76C8.71472 17.1243 6.59602 14.9974 5 12.5C3.39875 9.99346 2.3493 7.15837 1.938 4.20201C1.91342 3.92433 1.94494 3.64424 2.0309 3.38016C2.11687 3.11608 2.25538 2.87368 2.438 2.66801C2.62062 2.46235 2.84334 2.2982 3.09195 2.18591C3.34057 2.07362 3.60938 2.01562 3.882 2.01501H6.882C7.41979 2.00983 7.93659 2.2131 8.322 2.58001C9.05155 3.28592 9.58533 4.17082 9.867 5.14201C10.0277 5.6956 10.0537 6.27902 9.943 6.84501C9.8323 7.411 9.58773 7.94359 9.229 8.39801L8.22 9.66301C9.41976 11.9181 11.195 13.8048 13.35 15.131L14.602 14.12C15.0563 13.7612 15.5888 13.5165 16.1548 13.4056C16.7207 13.2948 17.3042 13.3207 17.858 13.481C18.8291 13.7629 19.7139 14.2968 20.419 15.026C20.7888 15.4096 20.9947 15.9286 20.991 16.468L22 16.92Z"
                    stroke="#0F71EF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="contact-info">
                <h3 className="contact-type">
                  <FormattedMessage id="phoneSupport" />
                </h3>
                <p className="contact-address">
                  +98 21 1234 5678
                </p>
                <p className="contact-description">
                  <FormattedMessage id="phoneSupportDesc" />
                </p>
              </div>
            </div>
            <div className="contact-card" onClick={() => handleContactClick('support')}>
              <div className="contact-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M22 6L12 13L2 6" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="contact-info">
                <h3 className="contact-type">
                  <FormattedMessage id="supportEmail" />
                </h3>
                <p className="contact-address">
                  support@example.com
                </p>
                <p className="contact-description">
                  <FormattedMessage id="supportEmailDesc" />
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Section */}
        <div className="support-section">
          <h2 className="section-title">
            <FormattedMessage id="sendFeedback" />
          </h2>
          <p className="section-description">
            <FormattedMessage id="feedbackDescription" />
          </p>

          <div className="feedback-form">
            <div className="feedback-input-group">
              <label htmlFor="feedback-subject">
                <FormattedMessage id="subject" />
              </label>
              <input
                type="text"
                id="feedback-subject"
                value={feedbackSubject} // This binds to state
                onChange={(e) => setFeedbackSubject(e.target.value)} // This updates state
                placeholder={intl.formatMessage({ id: 'subjectPlaceholder' })}
                className="feedback-input"
                disabled={isSubmitting}
              />
            </div>

            <div className="feedback-input-group">
              <label htmlFor="feedback-message">
                <FormattedMessage id="message" />
              </label>
              <textarea
                id="feedback-message"
                rows="4"
                value={feedbackMessage} // This binds to state
                onChange={(e) => setFeedbackMessage(e.target.value)} // This updates state
                placeholder={intl.formatMessage({ id: 'messagePlaceholder' })}
                className="feedback-textarea"
                disabled={isSubmitting}
              />
            </div>

            <button
              className={`submit-button ${isSubmitting ? 'submitting' : ''}`}
              onClick={handleFeedbackSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="submit-loading">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 1.5V4.5M10 15.5V18.5M3.5 10H0.5M19.5 10H16.5M15.8995 15.8995L13.9497 13.9497M4.10051 4.10051L6.05025 6.05025M15.8995 4.10051L13.9497 6.05025M4.10051 15.8995L6.05025 13.9497"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <FormattedMessage id="sending" />
                </>
              ) : (
                <>
                  <FormattedMessage id="sendFeedbackButton" />
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.5 17.5L17.5 2.5M17.5 2.5H7.5M17.5 2.5V12.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* App Version Footer */}
      <div className="support-footer">
        <img src={logo} alt={intl.formatMessage({ id: 'logoAlt' })} className="footer-logo" />
        <p className="footer-text">
          <FormattedMessage id="supportFooter" />
        </p>
      </div>
    </div>
  );
}

export default Support;