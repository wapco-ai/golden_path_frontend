import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuthStore } from './adminAuthStore';

const AdminProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { accessToken } = useAdminAuthStore();
  const isAuthenticated = Boolean(accessToken);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children || <Outlet />;
};

export default AdminProtectedRoute;
