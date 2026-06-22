import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewState = 'artists' | 'albums' | 'tracks' | 'albumDetail' | 'settings' | 'artistDetail' | 'genres' | 'genreDetail';

interface UIState {
  showLyrics: boolean;
  toggleLyrics: () => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  view: ViewState;
  setView: (view: ViewState) => void;
  showFps: boolean;
  toggleFps: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      showLyrics: false,
      toggleLyrics: () => set((state) => ({ showLyrics: !state.showLyrics })),
      themeColor: '#aa3bff',
      setThemeColor: (color: string) => set({ themeColor: color }),
      view: 'albums',
      setView: (view) => set({ view }),
      showFps: false,
      toggleFps: () => set((state) => ({ showFps: !state.showFps })),
    }),
    {
      name: 'ui-storage',
    }
  )
);
