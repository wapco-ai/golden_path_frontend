import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const DEFAULT_LANGUAGE = 'fa';

const resolveLangStorageKey = (pathname = window.location.pathname) =>
  pathname.startsWith('/admin') ? 'admin-lang-storage' : 'lang-storage';

const scopedStorage = {
  getItem: () => localStorage.getItem(resolveLangStorageKey()),
  setItem: (_, value) => localStorage.setItem(resolveLangStorageKey(), value),
  removeItem: () => localStorage.removeItem(resolveLangStorageKey())
};

export const getPersistedLanguage = (pathname = window.location.pathname) => {
  const key = resolveLangStorageKey(pathname);
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored);
    return parsed?.state?.language || null;
  } catch (error) {
    console.warn('Failed to parse persisted language:', error);
    return null;
  }
};

export const useLangStore = create(
  persist(
    (set) => ({
      language: DEFAULT_LANGUAGE,
      setLanguage: (lang) => set({ language: lang })
    }),
    {
      name: 'lang-storage',
      version: 1,
      storage: scopedStorage
    }
  )
);
