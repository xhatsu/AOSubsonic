import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SongPlay {
  count: number;
  lastPlayed: number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverArt?: string;
  id: string; // Ensure id is saved
}

export interface HistoryState {
  songs: Record<string, SongPlay>;
  artists: Record<string, number>;
  totalListeningSeconds: number;

  recordPlay: (song: { id: string; title: string; artist: string; album: string; duration: number; coverArt?: string }) => void;
  getTopSongs: (limit: number) => SongPlay[];
  getTopArtists: (limit: number) => { name: string; count: number }[];
  getHistorySizeKB: () => number;
  clearHistory: () => void;
}

const splitArtists = (raw: string) =>
  raw.split(/[,\/&]|feat\./i).map(a => a.trim()).filter(Boolean);

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      songs: {},
      artists: {},
      totalListeningSeconds: 0,

      recordPlay: (song) => set((state) => {
        const now = Date.now();
        const prevSong = state.songs[song.id];
        const newCount = prevSong ? prevSong.count + 1 : 1;
        
        const newSongs = {
          ...state.songs,
          [song.id]: {
            ...song,
            count: newCount,
            lastPlayed: now,
          }
        };

        const newArtists = { ...state.artists };
        const artistNames = splitArtists(song.artist || 'Unknown Artist');
        artistNames.forEach(artistName => {
          newArtists[artistName] = (newArtists[artistName] || 0) + 1;
        });

        return {
          songs: newSongs,
          artists: newArtists,
          totalListeningSeconds: state.totalListeningSeconds + (song.duration || 0),
        };
      }),

      getTopSongs: (limit: number) => {
        const state = get();
        return Object.values(state.songs)
          .sort((a, b) => b.count - a.count || b.lastPlayed - a.lastPlayed)
          .slice(0, limit);
      },

      getTopArtists: (limit: number) => {
        const state = get();
        return Object.entries(state.artists)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);
      },

      getHistorySizeKB: () => {
        const stateStr = localStorage.getItem('aosubsonic-play-history');
        if (!stateStr) return 0;
        return Number((new Blob([stateStr]).size / 1024).toFixed(2));
      },

      clearHistory: () => set({ songs: {}, artists: {}, totalListeningSeconds: 0 }),
    }),
    {
      name: 'aosubsonic-play-history',
    }
  )
);
