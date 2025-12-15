import React, { useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAdminAuthStore } from './adminAuthStore';
import './adminLayout.css';

const AdminLayout = () => {
  const { admin, logout, roles, permissions } = useAdminAuthStore();

  const sidebarItems = useMemo(() => ([
    { label: 'داشبورد', to: '/admin', permission: null },
    { label: 'مدیریت اماکن', to: '/admin/places', permission: 'places:manage' },
    { label: 'گزارش‌ها', to: '/admin/reports', permission: 'reports:view' }
  ]), []);

  const canSee = (item) => !item.permission || permissions.includes(item.permission);

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-title">GoldenPath Admin</span>
          {admin?.name && <span className="brand-subtitle">{admin.name}</span>}
        </div>
        <nav className="admin-nav">
          {sidebarItems.filter(canSee).map((item) => (
            <NavLink key={item.to} to={item.to} end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-footer">
          <div className="admin-meta">
            {roles?.length > 0 && <small>نقش‌ها: {roles.join(', ')}</small>}
          </div>
          <button className="admin-logout" type="button" onClick={logout}>خروج</button>
        </div>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
};

export default AdminLayout;
