import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useUserAuthStore } from './userAuthStore';

const UserProtectedRoute = ({ children, redirectTo = '/login' }) => {
  const location = useLocation();
  const { accessToken } = useUserAuthStore();

  if (!accessToken) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  return children || <Outlet />;
};

export default UserProtectedRoute;
