import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '../services/publicAuth/publicTokenStore';
import { usePublicAuthStore } from '../state/publicAuth/publicAuthStore';

export const PublicAuthGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, bootstrap, loading } = usePublicAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (!getAccessToken()) {
        setReady(true);
        return;
      }
      try {
        await bootstrap();
      } catch (error) {
        // handled in store
      } finally {
        if (active) setReady(true);
      }
    };
    init();
    return () => {
      active = false;
    };
  }, [bootstrap]);

  if (!getAccessToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (loading || !ready) {
    return <div className="page-loader">در حال بارگذاری...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const PublicProfileGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const profileCompleted = usePublicAuthStore((state) => state.profileCompleted);

  if (!profileCompleted) {
    return <Navigate to="/complete-profile" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default PublicAuthGuard;
