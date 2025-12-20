import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import '../styles/FAQ.css';

function FAQ() {
  const navigate = useNavigate();
  const intl = useIntl();
  const [faqExpandedItems, setFaqExpandedItems] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const showContactCTA = !searchQuery.trim();

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };


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

  const faqToggleItem = (itemId) => {
    setFaqExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // FAQ Data
  const faqItems = [
    {
      id: 'account',
      question: 'faqAccountQuestion',
      answer: 'faqAccountAnswer'
    },
    {
      id: 'password',
      question: 'faqPasswordQuestion',
      answer: 'faqPasswordAnswer'
    },
    {
      id: 'privacy',
      question: 'faqPrivacyQuestion',
      answer: 'faqPrivacyAnswer'
    },
    {
      id: 'payment',
      question: 'faqPaymentQuestion',
      answer: 'faqPaymentAnswer'
    },
    {
      id: 'technical',
      question: 'faqTechnicalQuestion',
      answer: 'faqTechnicalAnswer'
    },
    {
      id: 'support',
      question: 'faqSupportQuestion',
      answer: 'faqSupportAnswer'
    },
    {
      id: 'features',
      question: 'faqFeaturesQuestion',
      answer: 'faqFeaturesAnswer'
    },
    {
      id: 'updates',
      question: 'faqUpdatesQuestion',
      answer: 'faqUpdatesAnswer'
    }
  ];

  const filteredFaqItems = faqItems.filter(item => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const questionText = intl.formatMessage({ id: item.question }).toLowerCase();
    const answerText = intl.formatMessage({ id: item.answer }).toLowerCase();

    return questionText.includes(query) || answerText.includes(query);
  });

  return (
    <div className="faq-page-container">
      {/* Header with Back Arrow */}
      <div className="faq-header">
        <button className="faq-back-arrow" onClick={() => navigate(-1)}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3.33301 10H16.6663M16.6663 10L11.6663 5M16.6663 10L11.6663 15" stroke="#1E2023" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <h1 className="faq-title">
          <FormattedMessage id="faqTitle" />
        </h1>
      </div>

      {/* Main Content */}
      <div className="faq-content">
        {/* Introduction Section */}
        <div className="faq-intro-section">
        </div>

        {/* Search Bar (Optional) */}
        <div className="faq-search-section">
          <div className="faq-search-container">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.5 17.5L13.875 13.875M15.8333 9.16667C15.8333 12.8486 12.8486 15.8333 9.16667 15.8333C5.48477 15.8333 2.5 12.8486 2.5 9.16667C2.5 5.48477 5.48477 2.5 9.16667 2.5C12.8486 2.5 15.8333 5.48477 15.8333 9.16667Z" stroke="#858585" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              placeholder={intl.formatMessage({ id: 'searchFAQs' })}
              className="faq-search-input"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {/* FAQ Items */}
        <div className="faq-items-section">

          <div className="faq-items-container">
            {filteredFaqItems.map((item, index) => (
              <div
                key={item.id}
                className={`faq-item ${faqExpandedItems[item.id] ? 'faq-expanded' : ''}`}
                style={{ '--item-delay': `${index * 0.1}s` }}
              >
                <div
                  className="faq-item-header"
                  onClick={() => faqToggleItem(item.id)}
                >
                  <div className="faq-item-number">
                    {String(index + 1).padStart(2 )}
                  </div>
                  <div className="faq-item-question">
                    <FormattedMessage id={item.question} />
                  </div>
                  <div className="faq-item-arrow">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 7.5L10 12.5L15 7.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>

                <div className="faq-item-answer">
                  <p>
                    <FormattedMessage id={item.answer} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact CTA */}
        {showContactCTA && (
          <div className="faq-contact-cta">
            <div className="faq-contact-icon">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="28" cy="28" r="28" fill="white" />
                <path d="M28 42C35.732 42 42 35.732 42 28C42 20.268 35.732 14 28 14C20.268 14 14 20.268 14 28C14 35.732 20.268 42 28 42Z" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M28 36C28.8284 36 29.5 35.3284 29.5 34.5C29.5 33.6716 28.8284 33 28 33C27.1716 33 26.5 33.6716 26.5 34.5C26.5 35.3284 27.1716 36 28 36Z" fill="#0F71EF" />
                <path d="M28 30V28C30.2091 28 32 26.2091 32 24C32 21.7909 30.2091 20 28 20C25.7909 20 24 21.7909 24 24" stroke="#0F71EF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="faq-contact-title">
              <FormattedMessage id="stillHaveQuestions" />
            </h3>
            <p className="faq-contact-description">
              <FormattedMessage id="contactSupportDesc" />
            </p>
            <button
              className="faq-contact-button"
              onClick={() => navigate('/support')}
            >
              <FormattedMessage id="contactSupport" />
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.75 9H14.25M14.25 9L9.75 4.5M14.25 9L9.75 13.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="faq-footer">
      </div>
    </div>
  );
}

export default FAQ;