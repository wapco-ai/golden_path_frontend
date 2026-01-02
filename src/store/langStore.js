import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useLangStore = create(
  persist(
    (set) => ({
      language: 'fa',
      setLanguage: (lang) => set({ language: lang })
    }),
    {
      name: 'lang-storage',
      version: 1
    }
  )
);
