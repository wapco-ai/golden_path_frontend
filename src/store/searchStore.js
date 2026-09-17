import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPointFloor } from '../utils/floors.js';

export const useSearchStore = create(
  persist(
    (set, get) => ({
      recentSearches: [],
      addSearch: (item) =>
        set((state) => {
          const existsIndex = state.recentSearches.findIndex(
            (s) => s.name === item.name && s.location === item.location && getPointFloor(s) === getPointFloor(item)
          );
          let updated = [...state.recentSearches];
          if (existsIndex !== -1) {
            updated.splice(existsIndex, 1);
          }
          updated.unshift({ ...item, id: item.id || Date.now() });
          return { recentSearches: updated.slice(0, 5) };
        }),
      clearSearches: () => set({ recentSearches: [] })
    }),
    {
      name: 'recent-search-storage',
      version: 1
    }
  )
);
