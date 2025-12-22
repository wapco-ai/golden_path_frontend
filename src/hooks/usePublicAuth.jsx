import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { applyTokens, getMe, logout as logoutApi, refresh as refreshApi } from '../services/publicAuth/publicAuthClient';
import { clearTokens, getAccessToken, getRefreshToken } from '../services/publicAuth/tokenStore';

const PublicAuthContext = createContext(null);

const errorCodeMessages = {
  PHONE_EXISTS: 'این شماره قبلا ثبت شده است.',
  EMAIL_EXISTS: 'این ایمیل قبلا ثبت شده است.',
  INVALID_TOKEN: 'نشست شما منقضی شده است.',
  ACCOUNT_LOCKED: 'حساب شما قفل شده است.',
  PROFILE_INCOMPLETE: 'پروفایل کامل نیست.',
  VALIDATION_ERROR: 'ورودی‌ها نیاز به بررسی دارند.'
};

export const PublicAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const bootstrapped = useRef(false);

  const profileCompleted = Boolean(user?.profileCompleted);

  const setSessionFromOtp = useCallback((tokens) => {
    if (tokens?.accessToken && tokens?.refreshToken && tokens?.expiresIn) {
      applyTokens(tokens);
      if (tokens?.user) {
        setUser(tokens.user);
      }
    }
  }, []);

  const bootstrap = useCallback(async () => {
    if (bootstrapped.current || !getAccessToken()) return null;
    bootstrapped.current = true;
    setLoading(true);
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch (error) {
      clearTokens();
      setUser(null);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await logoutApi(refreshToken);
      }
    } catch (error) {
      // ignore network errors on logout
      console.error(error);
    } finally {
      clearTokens();
      setUser(null);
    }
  }, []);

  const ensureFreshSession = useCallback(async () => {
    if (!getAccessToken()) return null;
    if (!getRefreshToken()) return null;
    try {
      const refreshed = await refreshApi(getRefreshToken());
      if (refreshed?.user) {
        setUser(refreshed.user);
      }
      return refreshed;
    } catch (error) {
      await signOut();
      throw error;
    }
  }, [signOut]);

  const value = useMemo(
    () => ({
      user,
      profileCompleted,
      loading,
      bootstrap,
      signOut,
      setUser,
      setSessionFromOtp,
      ensureFreshSession
    }),
    [bootstrap, ensureFreshSession, loading, profileCompleted, signOut, user]
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

export const mapApiErrorToMessage = (error) => {
  const code = error?.response?.data?.code;
  return errorCodeMessages[code] || error?.response?.data?.message || 'خطایی رخ داده است.';
};

export const mapApiErrorToFields = (error) => {
  const errors = error?.response?.data?.errors || {};
  return Object.keys(errors).reduce((acc, key) => {
    acc[key] = Array.isArray(errors[key]) ? errors[key][0] : errors[key];
    return acc;
  }, {});
};

export default usePublicAuth;
