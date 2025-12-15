import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAdminAuthStore } from './adminAuthStore';
import './adminLogin.css';

const AdminLoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, login } = useAdminAuthStore();
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (accessToken) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await login({ usernameOrEmail, password });
      toast.success('با موفقیت وارد شدید');
      const redirectTo = location.state?.from?.pathname || '/admin';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'ورود ناموفق بود');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h1>ورود مدیر سیستم</h1>
          <p>برای دسترسی به داشبورد مدیریتی، اطلاعات خود را وارد کنید.</p>
        </div>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label className="admin-field">
            <span>نام کاربری یا ایمیل</span>
            <input
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className="admin-field">
            <span>رمز عبور</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <button className="admin-login-btn" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'در حال ورود...' : 'ورود'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
