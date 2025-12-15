import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuthStore } from './adminAuthStore';

const AdminGuestRoute = ({ children }) => {
  const { accessToken } = useAdminAuthStore();
  const isAuthenticated = Boolean(accessToken);

  if (isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return children || <Outlet />;
};

export default AdminGuestRoute;
