import axios from 'axios';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import appConfig from '../../config/appConfig';

export const USER_ACCESS_TOKEN_KEY = 'gp_user_access_token';
export const USER_REFRESH_TOKEN_KEY = 'gp_user_refresh_token';

const userAuthClient = axios.create({
  baseURL: `${appConfig.apiBaseUrl}/api/v1/auth`,
  headers: {
    Accept: 'application/json'
  }
});

const safeStorage = () => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
  }
  return localStorage;
};

const setUserStorage = ({ accessToken, refreshToken }) => {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    sessionStorage.setItem(USER_ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(USER_REFRESH_TOKEN_KEY, refreshToken);
  }
};

const clearUserStorage = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(USER_ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_REFRESH_TOKEN_KEY);
};

export const useUserAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      expiresIn: null,
      profileCompleted: null,
      isLoading: false,

      setSession: ({ accessToken, refreshToken, user, expiresIn, profileCompleted }) => {
        set({
          accessToken,
          refreshToken,
          user: user || null,
          expiresIn: expiresIn || null,
          profileCompleted:
            typeof profileCompleted === 'boolean'
              ? profileCompleted
              : user?.profileCompleted ?? null
        });
        setUserStorage({ accessToken, refreshToken });
      },

      clearSession: () => {
        clearUserStorage();
        set({ accessToken: null, refreshToken: null, user: null, expiresIn: null, profileCompleted: null });
      },

      refreshSession: async () => {
        const refreshToken = get().refreshToken || localStorage.getItem(USER_REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          throw new Error('User refresh token missing');
        }
        const response = await userAuthClient.post('/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefresh, user, expiresIn } = response.data || {};
        const nextRefreshToken = newRefresh || refreshToken;
        get().setSession({
          accessToken,
          refreshToken: nextRefreshToken,
          user: user || get().user,
          expiresIn
        });
        return response.data;
      },

      fetchMe: async () => {
        const token = get().accessToken || sessionStorage.getItem(USER_ACCESS_TOKEN_KEY);
        if (!token) {
          throw new Error('User access token missing');
        }

        const response = await axios.get(`${appConfig.apiBaseUrl}/api/v1/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const meData = response?.data || {};
        get().setSession({
          accessToken: token,
          refreshToken: get().refreshToken || localStorage.getItem(USER_REFRESH_TOKEN_KEY),
          user: meData,
          profileCompleted: typeof meData.profileCompleted === 'boolean' ? meData.profileCompleted : null
        });

        return meData;
      },

      // OTP login flow should replace this with actual implementation
      completeOtpLogin: ({ accessToken, refreshToken, user, expiresIn }) => {
        get().setSession({ accessToken, refreshToken, user, expiresIn });
      }
    }),
    {
      name: 'gp_user_auth_store',
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        expiresIn: state.expiresIn,
        profileCompleted: state.profileCompleted
      })
    }
  )
);

export default useUserAuthStore;
