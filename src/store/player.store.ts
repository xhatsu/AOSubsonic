import { create } from 'zustand';

export interface QueueSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  streamUrl: string;
  coverArtUrl?: string;
}

interface PlayerState {
  queue: QueueSong[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  
  // Actions
  setQueue: (songs: QueueSong[], startIndex?: number) => void;
  addToQueue: (song: QueueSong) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (vol: number) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  volume: 1,

  setQueue: (songs, startIndex = 0) => set({ queue: songs, currentIndex: startIndex }),
  addToQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  nextTrack: () => set((state) => {
    if (state.currentIndex < state.queue.length - 1) {
      return { currentIndex: state.currentIndex + 1, isPlaying: true };
    }
    return state;
  }),
  prevTrack: () => set((state) => {
    if (state.currentIndex > 0) {
      return { currentIndex: state.currentIndex - 1, isPlaying: true };
    }
    return state;
  }),
  setVolume: (vol) => set({ volume: vol }),
}));
