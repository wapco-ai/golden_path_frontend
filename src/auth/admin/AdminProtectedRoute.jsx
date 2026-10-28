import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  ADMIN_ACCESS_TOKEN_KEY,
  ADMIN_REFRESH_TOKEN_KEY,
  useAdminAuthStore
} from './adminAuthStore';

// React Strict Mode can mount this guard twice. Share the refresh operation so
// rotating the refresh token cannot invalidate a concurrent request.
let sessionCheck;
const verifyAdminSession = () => {
  if (!sessionCheck) {
    sessionCheck = (async () => {
      const store = useAdminAuthStore.getState();
      let token = store.accessToken || sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
      const refresh = store.refreshToken || localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
      if (!token && !refresh) throw new Error('No admin session');
      if (!token) {
        await store.refreshSession();
      }
      try {
        await store.fetchProfile();
      } catch (error) {
        // Expired access tokens can be renewed, but network errors and other
        // responses must never expose a previously cached profile.
        if (error?.response?.status !== 401 || !refresh) throw error;
        await store.refreshSession();
        await store.fetchProfile();
      }
    })().finally(() => { sessionCheck = null; });
  }
  return sessionCheck;
};

const AdminProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { accessToken, clearAuth } = useAdminAuthStore();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;
    verifyAdminSession()
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
  }, [clearAuth]);

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
