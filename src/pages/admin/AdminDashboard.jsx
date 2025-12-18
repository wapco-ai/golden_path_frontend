import React, { useEffect } from 'react';
import { useAdminAuthStore } from '../../auth/admin/adminAuthStore';
import '../../auth/admin/adminLayout.css';

const AdminDashboard = () => {
  const { admin, roles, permissions, fetchProfile } = useAdminAuthStore();

  useEffect(() => {
    if (!admin) {
      fetchProfile().catch(() => {});
    }
  }, [admin, fetchProfile]);

  return (
    <div className="admin-card">
      <h2>داشبورد مدیریتی</h2>
      <p>به بخش مدیریت GoldenPath خوش آمدید.</p>
      <div className="admin-grid">
        <div>
          <strong>نام:</strong> {admin?.name || '---'}
        </div>
        <div>
          <strong>نام کاربری:</strong> {admin?.username || '---'}
        </div>
        <div>
          <strong>ایمیل:</strong> {admin?.email || '---'}
        </div>
        <div>
          <strong>نقش‌ها:</strong> {(roles || []).join(', ') || '---'}
        </div>
        <div>
          <strong>دسترسی‌ها:</strong> {(permissions || []).join(', ') || '---'}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
