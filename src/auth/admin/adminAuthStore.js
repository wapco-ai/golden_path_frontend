import axios from 'axios';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import appConfig from '../../config/appConfig';

export const ADMIN_ACCESS_TOKEN_KEY = 'gp_admin_access_token';
export const ADMIN_REFRESH_TOKEN_KEY = 'gp_admin_refresh_token';

const getSessionAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
};

const authClient = axios.create({
  baseURL: `${appConfig.apiBaseUrl}/api/v1/admin/auth`,
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

const setTokenStorage = ({ accessToken, refreshToken }) => {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    localStorage.setItem(ADMIN_REFRESH_TOKEN_KEY, refreshToken);
  }
};

const clearTokenStorage = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ADMIN_REFRESH_TOKEN_KEY);
};

export const useAdminAuthStore = create(
  persist(
    (set, get) => ({
      accessToken: getSessionAccessToken(),
      refreshToken: null,
      admin: null,
      roles: [],
      permissions: [],
      expiresIn: null,
      isLoading: false,

      can: (permissionCode) => {
        const permissions = get().permissions || [];
        return permissions.includes(permissionCode);
      },

      hasRole: (roleCode) => {
        const roles = get().roles || [];
        return roles.includes(roleCode);
      },

      setAuth: ({ accessToken, refreshToken, user, expiresIn }) => {
        set({
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
          admin: user || null,
          roles: user?.roles || [],
          permissions: user?.permissions || [],
          expiresIn: expiresIn || null
        });
        setTokenStorage({ accessToken, refreshToken });
      },

      clearAuth: () => {
        clearTokenStorage();
        set({
          accessToken: null,
          refreshToken: null,
          admin: null,
          roles: [],
          permissions: [],
          expiresIn: null
        });
      },

      login: async ({ usernameOrEmail, password }) => {
        const response = await authClient.post('/login', { usernameOrEmail, password });
        const { accessToken, refreshToken, user, expiresIn } = response.data || {};
        get().setAuth({ accessToken, refreshToken, user, expiresIn });
        return response.data;
      },

      refreshSession: async () => {
        const refreshToken = get().refreshToken || localStorage.getItem(ADMIN_REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          throw new Error('Refresh token موجود نیست');
        }
        const response = await authClient.post('/refresh', { refreshToken }, { headers: { Authorization: undefined } });
        const { accessToken, refreshToken: newRefresh, user, expiresIn } = response.data || {};
        get().setAuth({ accessToken, refreshToken: newRefresh || refreshToken, user: user || get().admin, expiresIn });
        return response.data;
      },

      fetchProfile: async () => {
        const accessToken = get().accessToken || sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY);
        if (!accessToken) return null;
        const response = await authClient.get('/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        const user = response.data?.user || response.data?.admin || response.data;
        set({
          admin: user,
          roles: user?.roles || [],
          permissions: user?.permissions || []
        });
        return user;
      },

      logout: async () => {
        const { accessToken, refreshToken } = get();
        if (accessToken && refreshToken) {
          await authClient.post(
            '/logout',
            { refreshToken },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );
        }
        get().clearAuth();
      }
    }),
    {
      name: 'gp_admin_auth_store',
      storage: createJSONStorage(safeStorage),
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        admin: state.admin,
        roles: state.roles,
        permissions: state.permissions,
        expiresIn: state.expiresIn
      }),
      onRehydrateStorage: () => (state) => {
        const activeAccessToken = getSessionAccessToken();
        if (!state) return;

        state.accessToken = activeAccessToken;

        if (!activeAccessToken) {
          state.admin = null;
          state.roles = [];
          state.permissions = [];
          state.expiresIn = null;
        }
      }
    }
  )
);

export default useAdminAuthStore;
