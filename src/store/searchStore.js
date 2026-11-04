import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPointFloor } from '../utils/floors.js';
import { localizedPlaceAddress } from '../services/landmarkService.js';

export const useSearchStore = create(
  persist(
    (set) => ({
      recentSearches: [],
      addSearch: (item) =>
        set((state) => {
          const existsIndex = state.recentSearches.findIndex(
            (s) => (item.poiId != null || s.poiId != null)
              ? item.poiId != null && s.poiId != null && String(s.poiId) === String(item.poiId) && getPointFloor(s) === getPointFloor(item)
              : s.name === item.name && s.location === item.location && getPointFloor(s) === getPointFloor(item)
          );
          let updated = [...state.recentSearches];
          if (existsIndex !== -1) {
            updated.splice(existsIndex, 1);
          }
          updated.unshift({ ...item, id: item.id || Date.now() });
          return { recentSearches: updated.slice(0, 5) };
        }),
      removeSearch: (item) => set((state) => ({ recentSearches: state.recentSearches.filter((entry) => entry !== item) })),
      updateRecentAddress: (poiId, address, language) => set((state) => ({
        recentSearches: state.recentSearches.map((entry) => String(entry.poiId) === String(poiId)
          ? { ...entry, address, location: localizedPlaceAddress(address, language), addressLanguage: language }
          : entry)
      })),
      clearSearches: () => set({ recentSearches: [] })
    }),
    {
      name: 'recent-search-storage',
      version: 2,
      migrate: (state) => ({
        ...state,
        recentSearches: (Array.isArray(state?.recentSearches) ? state.recentSearches : []).map((entry) => {
          return { ...entry, location: typeof entry.address === 'string' ? entry.address : '', poiId: null, addressLanguage: null };
        })
      })
    }
  )
);
