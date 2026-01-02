import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAdminLangStore = create(
  persist(
    (set) => ({
      language: 'fa',
      setLanguage: (lang) => set({ language: lang })
    }),
    {
      name: 'admin-lang-storage',
      version: 1
    }
  )
);
