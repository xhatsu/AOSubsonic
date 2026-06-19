import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SubsonicConfig } from '../api/subsonic';

interface AuthState {
  config: SubsonicConfig | null;
  setConfig: (config: SubsonicConfig) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      config: null,
      setConfig: (config) => set({ config }),
      logout: () => set({ config: null }),
    }),
    {
      name: 'osclient-auth-storage',
    }
  )
);
