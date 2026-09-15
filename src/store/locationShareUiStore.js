import { create } from 'zustand';

export const useLocationShareUiStore = create((set) => ({
  isOpen: false,
  mode: 'share',
  incomingCount: 0,
  openShare: () => set({ isOpen: true, mode: 'share' }),
  openIncoming: () => set({ isOpen: true, mode: 'incoming' }),
  close: () => set({ isOpen: false }),
  setIncomingCount: (count) => set({
    incomingCount: Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0
  })
}));

export default useLocationShareUiStore;
