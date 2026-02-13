import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  ADMIN_ACCESS_TOKEN_KEY,
  ADMIN_REFRESH_TOKEN_KEY,
  useAdminAuthStore
} from './adminAuthStore';

const AdminProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { accessToken, refreshToken, refreshSession, clearAuth } = useAdminAuthStore();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const activeAccessToken = accessToken || sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
    const activeRefreshToken = refreshToken || localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);

    if (activeAccessToken) {
      setIsCheckingSession(false);
      return () => {
        isMounted = false;
      };
    }

    if (!activeRefreshToken) {
      clearAuth();
      setIsCheckingSession(false);
      return () => {
        isMounted = false;
      };
    }

    refreshSession()
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, clearAuth, refreshSession, refreshToken]);

  if (isCheckingSession) {
    return null;
  }

  const isAuthenticated = Boolean(accessToken || sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY));

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children || <Outlet />;
};

export default AdminProtectedRoute;
