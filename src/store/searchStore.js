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
          const existsIndex = state.recentSearches.findIndex((entry) => {
            if (getPointFloor(entry) !== getPointFloor(item)) return false;
            if (item.areaGroupId != null || entry.areaGroupId != null) {
              return item.areaGroupId != null && entry.areaGroupId != null
                && String(entry.areaGroupId) === String(item.areaGroupId);
            }
            if (item.areaId != null || entry.areaId != null) {
              return item.areaId != null && entry.areaId != null && String(entry.areaId) === String(item.areaId);
            }
            if (item.poiId != null || entry.poiId != null) {
              return item.poiId != null && entry.poiId != null && String(entry.poiId) === String(item.poiId);
            }
            return entry.name === item.name && entry.location === item.location;
          });
          const updated = [...state.recentSearches];
          if (existsIndex !== -1) {
            updated.splice(existsIndex, 1);
          }
          updated.unshift({ ...item, id: item.id || Date.now() });
          const groupedMembers = new Set((item.memberAreaIds || []).map(String));
          return {
            recentSearches: updated.filter(entry => getPointFloor(entry) !== getPointFloor(item)
              || !groupedMembers.has(String(entry.areaId))).slice(0, 5)
          };
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
