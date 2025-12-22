import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mapApiErrorToFields, mapApiErrorToMessage } from '../services/publicAuth/errorMapping';
import { clearTokens, getAccessToken, getRefreshToken } from '../services/publicAuth/publicTokenStore';
import setupPublicAuthInterceptor from '../services/publicAuth/publicAuthInterceptor';
import { usePublicAuthStore } from '../state/publicAuth/publicAuthStore';

const PublicAuthContext = createContext(null);

export const PublicAuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const store = usePublicAuthStore();

  useEffect(() => {
    setupPublicAuthInterceptor({
      onLogout: store.logout,
      onUnauthenticated: () => navigate('/login', { replace: true })
    });
  }, [store.logout, navigate]);

  const value = useMemo(
    () => ({
      ...store,
      hasAccessToken: Boolean(getAccessToken()),
      refreshToken: getRefreshToken(),
      clearTokens,
      mapApiErrorToMessage,
      mapApiErrorToFields
    }),
    [store]
  );

  return <PublicAuthContext.Provider value={value}>{children}</PublicAuthContext.Provider>;
};

export const usePublicAuth = () => {
  const context = useContext(PublicAuthContext);
  if (!context) {
    throw new Error('usePublicAuth must be used within PublicAuthProvider');
  }
  return context;
};

export { mapApiErrorToMessage, mapApiErrorToFields };

export default usePublicAuth;
