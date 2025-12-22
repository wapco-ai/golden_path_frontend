import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import usePublicAuth, { mapApiErrorToFields, mapApiErrorToMessage } from '../../hooks/usePublicAuth';

const SignupAfterOtpPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { completeSignup } = usePublicAuth();
  const [form, setForm] = useState({ phone: '', fullName: '', email: '', nationalId: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const phone = searchParams.get('phone') || location.state?.phone;
    if (phone) {
      setForm((prev) => ({ ...prev, phone }));
    }
  }, [location.search, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setMessage('');
    try {
      const me = await completeSignup(form);
      if (me?.profileCompleted) {
        navigate('/public-home', { replace: true });
      } else {
        navigate('/complete-profile', { replace: true, state: { from: location } });
      }
    } catch (error) {
      setMessage(mapApiErrorToMessage(error));
      setErrors(mapApiErrorToFields(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <h2>ثبت نام بعد از OTP</h2>
      {message && <div className="error-message">{message}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          شماره موبایل
          <input name="phone" value={form.phone} onChange={onChange} required />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>
        <label>
          نام و نام خانوادگی
          <input name="fullName" value={form.fullName} onChange={onChange} required />
          {errors.fullName && <span className="field-error">{errors.fullName}</span>}
        </label>
        <label>
          ایمیل
          <input type="email" name="email" value={form.email} onChange={onChange} required />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label>
          کدملی
          <input name="nationalId" value={form.nationalId} onChange={onChange} />
          {errors.nationalId && <span className="field-error">{errors.nationalId}</span>}
        </label>
        <label>
          گذرواژه (اختیاری)
          <input type="password" name="password" value={form.password} onChange={onChange} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'در حال ثبت...' : 'ایجاد حساب'}
        </button>
      </form>
    </div>
  );
};

export default SignupAfterOtpPage;
