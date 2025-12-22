import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import usePublicAuth from '../../hooks/usePublicAuth';
import { getAccessToken } from '../../services/publicAuth/tokenStore';

const PublicAuthGuard = ({ children }) => {
  const { user, bootstrap, loading } = usePublicAuth();
  const [ready, setReady] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (!getAccessToken()) {
        setReady(true);
        return;
      }
      try {
        await bootstrap();
      } catch (error) {
        // handled inside bootstrap
      } finally {
        if (isMounted) setReady(true);
      }
    };
    init();
    return () => {
      isMounted = false;
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

  return children;
};

export default PublicAuthGuard;
