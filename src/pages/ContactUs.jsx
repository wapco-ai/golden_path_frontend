import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateToPreviousPage } from '../utils/navigationHistory';
import { FormattedMessage, useIntl } from 'react-intl';
import logo from '../assets/images/logo.png';
import '../styles/ContactUs.css';
import { fetchContactPage } from '../services/publicPagesService';
import { useLangStore } from '../store/langStore';

function ContactUs() {
  const navigate = useNavigate();
  const intl = useIntl();
  const language = useLangStore((state) => state.language);
  const [contactContent, setContactContent] = useState(null);

  useEffect(() => {

    window.scrollTo(0, 0);


    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;


    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.body.style.overflow = 'auto';
    }, 10);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    const loadContactContent = async () => {
      try {
        const data = await fetchContactPage(language);
        if (isMounted) {
          setContactContent(data);
        }
      } catch (error) {
        if (isMounted) {
          setContactContent(null);
        }
      }
    };

    loadContactContent();

    return () => {
      isMounted = false;
    };
  }, [language]);

  const contactPhones = contactContent?.phones?.slice(0, 3) || [];
  const contactEmails = contactContent?.emails?.slice(0, 3) || [];
  const primaryPhone = contactPhones[0] || '+98 21 1234 5678';
  const primaryEmail = contactEmails[0] || 'info@example.com';
  const contactAddress = contactContent?.address || intl.formatMessage({ id: 'companyAddress' });

  const handleAddressClick = () => {
    // For mobile, open maps app
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      const encodedAddress = encodeURIComponent(contactAddress);
      window.open(`https://maps.google.com/?q=${encodedAddress}`, '_blank');
    } else {
      // For desktop, show address
      navigator.clipboard.writeText(contactAddress)
        .then(() => {
          alert(intl.formatMessage({ id: 'addressCopied' }));
        });
    }
  };

  return (
    <div className="contactus-page-container">
      {/* Header with Back Arrow */}
      <div className="contactus-header">
        <button className="contactus-back-arrow" onClick={() => navigateToPreviousPage(navigate)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.33301 10H16.6663M16.6663 10L11.6663 5M16.6663 10L11.6663 15" stroke="#1E2023" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h1 className="contactus-title">
          {contactContent?.title || <FormattedMessage id="contactUsTitle" />}
        </h1>
      </div>

      {/* Main Content */}
      <div className="contactus-content">
        {/* Welcome Section */}
        <div className="contactus-welcome-section">
          <div className="contactus-welcome-icon">
            <img src={logo} alt={intl.formatMessage({ id: 'logoAlt' })} className="contactus-header-logo2" />
          </div>
          <h2 className="contactus-welcome-title">
            <FormattedMessage id="contactWelcomeTitle" />
          </h2>
          <p className="contactus-welcome-description">
            {contactContent?.description || <FormattedMessage id="contactWelcomeDescription" />}
          </p>
        </div>

        {/* Contact Information Cards */}
        <div className="contactus-info-section">
          {/* Email Card */}
          <div className="contactus-info-card">
            <div className="contactus-card-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M26.6667 8H5.33333C4.59695 8 4 8.59695 4 9.33333V22.6667C4 23.403 4.59695 24 5.33333 24H26.6667C27.403 24 28 23.403 28 22.6667V9.33333C28 8.59695 27.403 8 26.6667 8Z" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M28 9.33333L16 17.3333L4 9.33333" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="contactus-card-content">
              <h3 className="contactus-card-title">
                <FormattedMessage id="contactEmailTitle" />
              </h3>
              <p className="contactus-card-detail">
                {contactEmails.length ? contactEmails.join('، ') : primaryEmail}
              </p>
            </div>
          </div>

          {/* Phone Card */}
          <div className="contactus-info-card">
            <div className="contactus-card-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.6667 4H9.33333C8.59695 4 8 4.59695 8 5.33333V26.6667C8 27.403 8.59695 28 9.33333 28H22.6667C23.403 28 24 27.403 24 26.6667V5.33333C24 4.59695 23.403 4 22.6667 4Z" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 6V6.01333" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 24V24.0133" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="contactus-card-content">
              <h3 className="contactus-card-title">
                <FormattedMessage id="contactPhoneTitle" />
              </h3>
              <p className="contactus-card-detail">
                {contactPhones.length ? contactPhones.join('، ') : primaryPhone}
              </p>
            </div>
          </div>

          {/* Address Card */}
          <div className="contactus-info-card">
            <div className="contactus-card-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28Z" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 16C17.1046 16 18 15.1046 18 14C18 12.8954 17.1046 12 16 12C14.8954 12 14 12.8954 14 14C14 15.1046 14.8954 16 16 16Z" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 8V10" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 16H10" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 22V24" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M22 16H24" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19.0711 19.0711L20.4853 20.4853" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.9289 19.0711L11.5147 20.4853" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M19.0711 12.9289L20.4853 11.5147" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.9289 12.9289L11.5147 11.5147" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="contactus-card-content">
              <h3 className="contactus-card-title">
                <FormattedMessage id="contactAddressTitle" />
              </h3>
              <p className="contactus-card-detail">
                {contactAddress}
              </p>
              <button className="contactus-card-button" onClick={handleAddressClick}>
                <FormattedMessage id="viewOnMap" />
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-map-pin"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" /><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="contactus-footer">
        <img src={logo} alt={intl.formatMessage({ id: 'logoAlt' })} className="contactus-footer-logo" />
        <p className="contactus-footer-text">
          <FormattedMessage id="contactFooter" />
        </p>
      </div>
    </div>
  );
}

export default ContactUs;
