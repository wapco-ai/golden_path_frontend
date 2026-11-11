import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormattedMessage, useIntl } from 'react-intl';
import logo from '../assets/images/logo.png';
import { useLangStore } from '../store/langStore';
import { fetchLanguages } from '../services/languageService';
import '../styles/LangPage.css';

const LangPage = () => {
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const setLanguage = useLangStore((state) => state.setLanguage);
  const intl = useIntl();

  useEffect(() => {
    let isMounted = true;

    const loadLanguages = async () => {
      try {
        const result = await fetchLanguages();
        if (!isMounted) return;
        const fetchedLanguages = result?.data || [];
        setLanguages(fetchedLanguages);
        const defaultId = result?.meta?.defaultLanguageId || fetchedLanguages[0]?.id || null;
        setSelectedLanguage(defaultId);
      } catch (err) {
        if (isMounted) {
          setError('خطا در دریافت زبان‌ها');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadLanguages();

    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const handleLogin = () => {
    if (selectedLanguage) {
      const selected = languages.find((l) => l.id === selectedLanguage);
      if (selected) {
        const langCode = selected.code || selected.locale?.split('_')[0];
        if (langCode) {
          setLanguage(langCode);
        }
      }
      navigate('/mpb');
    }
  };

  const handleSelect = (id) => {
    setSelectedLanguage(id);
    setIsOpen(false);
  };

  const selectedLang = languages.find((l) => l.id === selectedLanguage);

  const getLangLabel = (lang) => {
    if (!lang) return '';
    return intl.locale === 'en' ? lang.english_name : lang.name;
  };

  return (
    <div className="lang-page-container">
      <img src={logo} alt={intl.formatMessage({ id: 'logoAlt' })} className="lang-logo" />

      <div className="lang-welcome-text">
        <h1 className="welcome-heading"><FormattedMessage id="welcome" /></h1>
        <p
          className="welcome-paragraph"
          dangerouslySetInnerHTML={{
            __html: intl.formatMessage({ id: 'selectLanguage' })
          }}
        />
      </div>

      <div className="lang-dropdown-wrapper" ref={dropdownRef}>
        {loading && (
          <div className="lang-dropdown-trigger loading-trigger" aria-busy="true">
            <span className="lang-name">
              <FormattedMessage id="loading" defaultMessage="Loading..." />
            </span>
          </div>
        )}

        {!loading && error && (
          <div className="lang-dropdown-trigger error-trigger">
            <span className="lang-name">{error}</span>
          </div>
        )}

        {!loading && !error && (
          <>
            <button
              type="button"
              className={`lang-dropdown-trigger ${isOpen ? 'open' : ''}`}
              onClick={() => setIsOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={isOpen}
            >
              <div className="trigger-inner">
                {selectedLang ? (
                  <div className="lang-selected-info">
                    <span className={`lang-code-chip lang-code-chip-${selectedLang.code?.toLowerCase()}`}>
                      {selectedLang.code?.toUpperCase()}
                    </span>
                    <span className="lang-name">{getLangLabel(selectedLang)}</span>
                  </div>
                ) : (
                  <span className="lang-name placeholder">
                    <FormattedMessage id="selectLanguagePlaceholder" defaultMessage="Select a language" />
                  </span>
                )}
              </div>
              <svg
                className={`dropdown-chevron ${isOpen ? 'rotated' : ''}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            <div className={`lang-dropdown-menu ${isOpen ? 'open' : ''}`} role="listbox">
              {languages.map((lang) => (
                <div
                  key={lang.id}
                  role="option"
                  aria-selected={selectedLanguage === lang.id}
                  className={`lang-dropdown-item ${selectedLanguage === lang.id ? 'selected' : ''}`}
                  onClick={() => handleSelect(lang.id)}
                >
                  <div className="item-check">
                    {selectedLanguage === lang.id && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className={`lang-code-chip lang-code-chip-${lang.code?.toLowerCase()}`}>
                    {lang.code?.toUpperCase()}
                  </span>
                  <span className={`lang-name ${lang.direction === 'ltr' ? 'force-rtl' : ''}`}>
                    {getLangLabel(lang)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <button
        className={`lang-login-btn ${!selectedLanguage ? 'disabled' : ''}`}
        disabled={!selectedLanguage}
        onClick={handleLogin}
      >
        <FormattedMessage id="loginButton" />
      </button>
    </div>
  );
};

export default LangPage;