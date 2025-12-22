import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import logo from '../assets/images/logo.png';
import '../styles/Login.css';

const LoginPage = () => {
  const intl = useIntl();
  const [phone, setPhone] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [formattedPhone, setFormattedPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '']);
  const [showError, setShowError] = useState(false);

  const isValidIranianPhone = (phone) => /^09[0-9]{9}$/.test(phone);

  const handlePhoneChange = (e) => {
    const input = e.target.value.replace(/\D/g, '');
    if (input.length <= 11) {
      setPhone(input);
      setShowError(false);
    }
  };

  const handleCodeChange = (e, index) => {
    const value = e.target.value.replace(/\D/g, '');
    const newCode = [...verificationCode];

    if (value.length <= 1) {
      newCode[index] = value;
      setVerificationCode(newCode);

      if (value && index < 4) {
        document.getElementById(`code-input-${index + 1}`).focus();
      } else if (e.nativeEvent.inputType === 'deleteContentBackward' && !value && index > 0) {
        document.getElementById(`code-input-${index - 1}`).focus();
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'ArrowLeft' && index > 0) {
      document.getElementById(`code-input-${index - 1}`).focus();
    } else if (e.key === 'ArrowRight' && index < 4) {
      document.getElementById(`code-input-${index + 1}`).focus();
    }
  };

  const handleSubmitPhone = (e) => {
    e.preventDefault();
    if (!isValidIranianPhone(phone)) {
      setShowError(true);
      return;
    }

    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const formatted = phone.split('').map(d => persianDigits[parseInt(d)]).join('');
    setFormattedPhone(formatted);
    setShowVerification(true);
  };

  return (
    <div className="login-page">
      {showError && (
        <div className="error-message">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="error-icon">
            <path fillRule="evenodd" clipRule="evenodd" d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12ZM12 6.25C12.4142 6.25 12.75 6.58579 12.75 7V13C12.75 13.4142 12.4142 13.75 12 13.75C11.5858 13.75 11.25 13.4142 11.25 13V7C11.25 6.58579 11.5858 6.25 12 6.25ZM12 17C12.5523 17 13 16.5523 13 16C13 15.4477 12.5523 15 12 15C11.4477 15 11 15.4477 11 16C11 16.5523 11.4477 17 12 17Z" fill="#EA4335" />
          </svg>
          <FormattedMessage id="invalidPhone" />
        </div>
      )}
      <div className="login-container">
        <div className="logo-container">
          <img
            src={logo}
            alt={intl.formatMessage({ id: 'logoAlt' })}
            className="login-logo"
          />
        </div>

        <div className="login-text-content">
          <h1 className="login-title">
            {showVerification ? (
              <FormattedMessage id="enterVerification" />
            ) : (
              <FormattedMessage id="loginTitle" />
            )}
          </h1>

          {showVerification ? (
            <div className="verification-message">
              <p>
                <FormattedMessage
                  id="sentCode"
                  values={{
                    phone: (chunks) => (
                      <span dir="ltr" className="phone-number">{chunks}</span>
                    ),
                    phoneNumber: formattedPhone
                  }}
                />
              </p>
              <div className="verification-edit">
                <span><FormattedMessage id="wrongPhone" /></span>
                <button
                  type="button"
                  className="edit-button"
                  onClick={() => setShowVerification(false)}
                >
                  <FormattedMessage id="edit" />
                </button>
              </div>
            </div>
          ) : (
            <p className="login-description">
              <FormattedMessage id="enterPhone" />
            </p>
          )}
        </div>

        {showVerification ? (
          <div className="verification-container" dir="ltr">
            <div className="verification-code-inputs">
              {verificationCode.map((digit, index) => (
                <input
                  key={index}
                  id={`code-input-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="1"
                  value={digit}
                  onChange={(e) => handleCodeChange(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="code-input"
                  dir="ltr"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            <div className="verification-resend">
              <span>
                <FormattedMessage id="resendCode" values={{ seconds: 50 }} />
              </span>
            </div>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmitPhone}>
            <div className="form-group">
              <div className="phone-input-container">
                <svg width="22" height="22" viewBox="0 0 20 20" fill="none" className="phone-icon">
                  <path d="M11.0503 1.56673C11.1055 1.22599 11.4276 0.994843 11.7684 1.05001C11.7894 1.05404 11.8573 1.06673 11.8929 1.07465C11.964 1.09048 12.0632 1.11486 12.1868 1.15089C12.4341 1.22292 12.7797 1.34159 13.1943 1.53171C14.0246 1.91233 15.1294 2.57817 16.2759 3.72467C17.4224 4.87117 18.0882 5.97602 18.4689 6.80625C18.659 7.22093 18.7777 7.56643 18.8497 7.81375C18.8857 7.93742 18.9101 8.03661 18.9259 8.10772C18.9338 8.14327 18.9396 8.17182 18.9437 8.19291L18.9485 8.21891C19.0036 8.55965 18.7746 8.89508 18.4338 8.95025C18.0941 9.00525 17.774 8.77523 17.7175 8.43608C17.7157 8.42698 17.711 8.40251 17.7058 8.37944C17.6955 8.33329 17.6778 8.2601 17.6496 8.16331C17.5932 7.96969 17.4952 7.68192 17.3326 7.32719C17.0077 6.6186 16.4236 5.64011 15.392 4.60856C14.3605 3.577 13.382 2.99284 12.6734 2.66798C12.3187 2.50535 12.0309 2.40741 11.8373 2.35101C11.7405 2.32282 11.6188 2.2949 11.5727 2.28462C11.2335 2.2281 10.9953 1.9065 11.0503 1.56673Z" fill="#1E2023" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M11.2389 4.44128C11.3337 4.10939 11.6796 3.9172 12.0115 4.01203L11.8398 4.61298C12.0115 4.01203 12.0115 4.01203 12.0115 4.01203L12.0127 4.01238L12.014 4.01274L12.0168 4.01356L12.0232 4.01548L12.0397 4.02062C12.0523 4.02464 12.068 4.02987 12.0867 4.03651C12.1241 4.04979 12.1736 4.06868 12.2343 4.09468C12.3557 4.14671 12.5215 4.22706 12.7253 4.34765C13.1332 4.58906 13.69 4.99004 14.3442 5.64418C14.9983 6.29833 15.3993 6.85515 15.6407 7.26303C15.7613 7.46679 15.8416 7.63268 15.8937 7.75408C15.9197 7.81476 15.9385 7.86422 15.9518 7.90165C15.9585 7.92036 15.9637 7.93605 15.9677 7.94861L15.9729 7.9651L15.9748 7.97156L15.9756 7.97434L15.976 7.97562C15.976 7.97562 15.9763 7.97682 15.3754 8.14852L15.9763 7.97682C16.0711 8.30871 15.879 8.65464 15.5471 8.74947C15.218 8.84349 14.8751 8.65536 14.7769 8.32864L14.7738 8.31966C14.7694 8.30714 14.7602 8.28249 14.7447 8.24648C14.7139 8.17454 14.658 8.05684 14.565 7.89968C14.3792 7.58573 14.0436 7.11136 13.4603 6.52807C12.877 5.94477 12.4026 5.60918 12.0887 5.42338C11.9315 5.33036 11.8138 5.27445 11.7419 5.24361C11.7059 5.22818 11.6812 5.21899 11.6687 5.21455L11.6597 5.21147C11.333 5.11323 11.1448 4.77036 11.2389 4.44128Z" fill="#1E2023" />
                  <path fillRule="evenodd" clipRule="evenodd" d="M4.17353 3.67237C5.57358 2.27231 7.9362 2.37874 8.91105 4.12551L9.45189 5.09462C10.0885 6.2353 9.81721 7.67453 8.88529 8.61784C8.87288 8.63485 8.8071 8.73062 8.79891 8.89797C8.78845 9.11157 8.86431 9.60555 9.62967 10.3709C10.3948 11.136 10.8887 11.2121 11.1024 11.2017C11.2699 11.1935 11.3657 11.1277 11.3827 11.1153C12.3261 10.1834 13.7653 9.91209 14.906 10.5487L15.8751 11.0895C17.6218 12.0644 17.7283 14.427 16.3282 15.827C15.5793 16.5759 14.5836 17.2413 13.4134 17.2857C11.6793 17.3514 8.79993 16.9036 5.94844 14.0521C3.09695 11.2006 2.64913 8.32129 2.71487 6.58718C2.75923 5.41701 3.42464 4.42125 4.17353 3.67237ZM7.81953 4.73467C7.32035 3.84022 5.97893 3.63472 5.05741 4.55625C4.41129 5.20237 3.99123 5.91555 3.96397 6.63453C3.90915 8.08065 4.26619 10.6021 6.83232 13.1683C9.39846 15.7344 11.9199 16.0914 13.366 16.0366C14.085 16.0093 14.7982 15.5893 15.4443 14.9432C16.3659 14.0216 16.1604 12.6802 15.2659 12.181L14.2968 11.6402C13.694 11.3038 12.8472 11.4185 12.2528 12.0129C12.1944 12.0713 11.8227 12.4181 11.1631 12.4502C10.4879 12.483 9.67065 12.1797 8.74578 11.2548C7.82061 10.3296 7.51734 9.51212 7.5504 8.83684C7.5827 8.17724 7.92955 7.80591 7.98759 7.74786C8.58202 7.15343 8.69681 6.30662 8.36037 5.70378L7.81953 4.73467Z" fill="#1E2023" />
                </svg>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder={intl.formatMessage({ id: 'phonePlaceholder' })}
                  dir="ltr"
                  className={`phone-input ${showError ? 'error' : ''}`}
                  maxLength="11"
                />
              </div>
            </div>
            <button
              type="submit"
              className={`login-button ${isValidIranianPhone(phone) ? 'active' : ''}`}
              disabled={!isValidIranianPhone(phone)}
            >
              <FormattedMessage id="loginButton" />
            </button>
          </form>
        )}

        {!showVerification && (
          <div className="login-terms">
            <p
              dangerouslySetInnerHTML={{
                __html: intl.formatMessage({ id: 'terms' })
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginPage;