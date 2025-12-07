import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ADMIN_ACCESS_TOKEN_KEY,
  fetchCurrentAdmin,
  logoutAdmin
} from '../services/adminAuthService';

const AdminLoginServiceContext = createContext({
  adminProfile: null,
  isLoadingProfile: false,
  refreshAdminProfile: async () => {},
  logout: async () => {}
});

export const AdminLoginServiceProvider = ({ children }) => {
  const navigate = useNavigate();
  const [adminProfile, setAdminProfile] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const refreshAdminProfile = useCallback(async () => {
    setIsLoadingProfile(true);

    try {
      const profile = await fetchCurrentAdmin({});
      setAdminProfile(profile?.admin || profile || null);
    } catch (error) {
      setAdminProfile(null);
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);

    if (!token) {
      setIsLoadingProfile(false);
      return;
    }

    refreshAdminProfile();
  }, [refreshAdminProfile]);

  const logout = useCallback(async () => {
    try {
      await logoutAdmin({});
      setAdminProfile(null);
      toast.success('با موفقیت خارج شدید');
    } catch (error) {
      toast.error(error?.message || 'خروج ناموفق بود');
    } finally {
      navigate('/alogin');
    }
  }, [navigate]);

  const contextValue = useMemo(
    () => ({ adminProfile, isLoadingProfile, refreshAdminProfile, logout }),
    [adminProfile, isLoadingProfile, refreshAdminProfile, logout]
  );

  return (
    <AdminLoginServiceContext.Provider value={contextValue}>
      {children}
    </AdminLoginServiceContext.Provider>
  );
};

export const useAdminLoginService = () => useContext(AdminLoginServiceContext);

export default AdminLoginServiceContext;
