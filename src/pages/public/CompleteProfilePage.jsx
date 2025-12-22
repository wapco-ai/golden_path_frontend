import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useProfile from '../../hooks/useProfile';
import { mapApiErrorToFields, mapApiErrorToMessage, usePublicAuth } from '../../hooks/usePublicAuth';

const defaultForm = {
  fullName: '',
  email: '',
  gender: '',
  birthDate: '',
  nationalId: '',
  avatarUrl: ''
};

const CompleteProfilePage = () => {
  const navigate = useNavigate();
  const { user } = usePublicAuth();
  const { getProfile, updateProfile, loading } = useProfile();
  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const profile = await getProfile();
        if (mounted && profile) {
          setForm((prev) => ({
            ...prev,
            ...profile
          }));
        }
      } catch (error) {
        setMessage(mapApiErrorToMessage(error));
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [getProfile]);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({ ...prev, ...user }));
    }
  }, [user]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setMessage('');
    try {
      const profile = await updateProfile(form);
      if (profile?.profileCompleted) {
        navigate('/public-home', { replace: true });
      }
    } catch (error) {
      setMessage(mapApiErrorToMessage(error));
      setErrors(mapApiErrorToFields(error));
    }
  };

  return (
    <div className="form-page">
      <h2>تکمیل پروفایل</h2>
      {message && <div className="error-message">{message}</div>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          نام و نام خانوادگی
          <input name="fullName" value={form.fullName || ''} onChange={onChange} required />
          {errors.fullName && <span className="field-error">{errors.fullName}</span>}
        </label>
        <label>
          ایمیل
          <input type="email" name="email" value={form.email || ''} onChange={onChange} required />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
        <label>
          جنسیت
          <select name="gender" value={form.gender || ''} onChange={onChange}>
            <option value="">انتخاب کنید</option>
            <option value="male">مرد</option>
            <option value="female">زن</option>
          </select>
        </label>
        <label>
          تاریخ تولد (YYYY-MM-DD)
          <input name="birthDate" value={form.birthDate || ''} onChange={onChange} />
        </label>
        <label>
          کدملی
          <input name="nationalId" value={form.nationalId || ''} onChange={onChange} />
          {errors.nationalId && <span className="field-error">{errors.nationalId}</span>}
        </label>
        <label>
          آواتار (URL)
          <input name="avatarUrl" value={form.avatarUrl || ''} onChange={onChange} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'در حال ذخیره...' : 'ذخیره و ادامه'}
        </button>
      </form>
    </div>
  );
};

export default CompleteProfilePage;
