import { getSessionFloor } from '../utils/sessionFloor.js';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useRouteStore = create(
  persist(
    (set) => ({
      origin: null,
      destination: null,
      routeGeo: null,
      routeSteps: [],
      transportMode: 'walking',
      gender: 'male',
      alternativeRoutes: [],
      setOrigin: (origin) => set({ origin: origin ? { ...origin, floor: origin.floor ?? getSessionFloor() } : null }),
      setDestination: (destination) => set({ destination: destination ? { ...destination, floor: destination.floor ?? getSessionFloor() } : null }),
      setRouteGeo: (routeGeo) => set({ routeGeo }),
      setRouteSteps: (routeSteps) => set({ routeSteps }),
      setTransportMode: (transportMode) => set({ transportMode }),
      setGender: (gender) => set({ gender }),
      setAlternativeRoutes: (alternativeRoutes) => set({ alternativeRoutes }),
      clearRoute: () =>
        set({ origin: null, destination: null, routeGeo: null, routeSteps: [], alternativeRoutes: [], transportMode: 'walking', gender: 'male' })
    }),
    {
      name: 'route-storage',
      version: 1
    }
  )
);
