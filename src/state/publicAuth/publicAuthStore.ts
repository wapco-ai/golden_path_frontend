import { create } from 'zustand';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../../services/publicAuth/publicTokenStore';
import { createUser, logout as logoutApi, me as meApi, updateProfile as updateProfileApi } from '../../services/publicAuth/publicAuthClient';

interface PublicAuthState {
  user: any | null;
  profileCompleted: boolean;
  loading: boolean;
  bootstrap: () => Promise<any | null>;
  setTokensFromOtp: (tokens: { accessToken: string; refreshToken: string; expiresIn: number; user?: any }) => void;
  completeSignup: (payload: Record<string, any>) => Promise<any>;
  updateProfile: (payload: Record<string, any>) => Promise<any>;
  logout: () => Promise<void>;
  setUser: (user: any | null) => void;
}

export const usePublicAuthStore = create<PublicAuthState>((set, get) => ({
  user: null,
  profileCompleted: false,
  loading: false,

  setUser: (user) => set({ user, profileCompleted: Boolean(user?.profileCompleted) }),

  bootstrap: async () => {
    if (!getAccessToken()) return null;
    set({ loading: true });
    try {
      const me = await meApi();
      set({ user: me, profileCompleted: Boolean(me?.profileCompleted) });
      return me;
    } catch (error) {
      clearTokens();
      set({ user: null, profileCompleted: false });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  setTokensFromOtp: ({ accessToken, refreshToken, expiresIn, user }) => {
    if (accessToken && refreshToken && expiresIn) {
      setTokens({ accessToken, refreshToken, expiresIn });
    }
    if (user) {
      set({ user, profileCompleted: Boolean(user?.profileCompleted) });
    }
  },

  completeSignup: async (payload) => {
    set({ loading: true });
    try {
      await createUser(payload);
      const me = await meApi();
      set({ user: me, profileCompleted: Boolean(me?.profileCompleted) });
      return me;
    } finally {
      set({ loading: false });
    }
  },

  updateProfile: async (payload) => {
    set({ loading: true });
    try {
      const profile = await updateProfileApi(payload);
      set({ user: profile, profileCompleted: Boolean(profile?.profileCompleted) });
      return profile;
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await logoutApi({ refreshToken });
      }
    } catch (error) {
      // ignore
      console.error(error);
    } finally {
      clearTokens();
      set({ user: null, profileCompleted: false });
    }
  }
}));

export default usePublicAuthStore;
