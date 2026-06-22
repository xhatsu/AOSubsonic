import { create } from 'zustand';

const getInitialVolume = () => {
  if (typeof window === 'undefined') return 1;
  const saved = localStorage.getItem('player_volume');
  return saved !== null ? parseFloat(saved) : 1;
};

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
  showQueue: boolean;
  
  // Actions
  setQueue: (songs: QueueSong[], startIndex?: number) => void;
  addToQueue: (song: QueueSong) => void;
  addListToQueue: (songs: QueueSong[]) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playFromQueue: (index: number) => void;
  toggleQueue: () => void;
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
  volume: getInitialVolume(),
  showQueue: false,

  setQueue: (songs, startIndex = 0) => set({ queue: songs, currentIndex: startIndex }),
  addToQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),
  addListToQueue: (songs) => set((state) => ({ queue: [...state.queue, ...songs] })),
  removeFromQueue: (index) => set((state) => {
    const newQueue = state.queue.filter((_, i) => i !== index);
    let newIndex = state.currentIndex;
    if (index < state.currentIndex) {
      newIndex = Math.max(0, state.currentIndex - 1);
    } else if (index === state.currentIndex) {
      newIndex = Math.min(state.currentIndex, newQueue.length - 1);
    }
    return {
      queue: newQueue,
      currentIndex: Math.max(0, newIndex),
      isPlaying: newQueue.length > 0 ? state.isPlaying : false
    };
  }),
  clearQueue: () => set({ queue: [], currentIndex: 0, isPlaying: false }),
  playFromQueue: (index) => set({ currentIndex: index, isPlaying: true }),
  toggleQueue: () => set((state) => ({ showQueue: !state.showQueue })),
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
  setVolume: (vol) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('player_volume', vol.toString());
    }
    set({ volume: vol });
  },
}));
