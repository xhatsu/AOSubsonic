import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewState = 'home' | 'artists' | 'albums' | 'tracks' | 'albumDetail' | 'settings' | 'artistDetail' | 'genres' | 'genreDetail' | 'playlists' | 'playlistDetail' | 'search';
export type LyricsStyle = 'dynamic' | 'clean';

interface UIState {
  showLyrics: boolean;
  toggleLyrics: () => void;
  themeColor: string;
  setThemeColor: (color: string) => void;
  view: ViewState;
  setView: (view: ViewState) => void;
  showFps: boolean;
  toggleFps: () => void;
  lyricsStyle: LyricsStyle;
  setLyricsStyle: (style: LyricsStyle) => void;
  dominantColor: string | null;
  setDominantColor: (color: string | null) => void;
  
  selectedAlbumId: string;
  setSelectedAlbumId: (id: string) => void;
  selectedAlbumCover: string;
  setSelectedAlbumCover: (cover: string) => void;
  
  selectedArtistId: string;
  setSelectedArtistId: (id: string) => void;
  selectedArtistCover: string;
  setSelectedArtistCover: (cover: string) => void;
  
  selectedPlaylistId: string;
  setSelectedPlaylistId: (id: string) => void;
  
  selectedGenre: string;
  setSelectedGenre: (genre: string) => void;

  llmProvider: 'gemini' | 'openai' | 'manual';
  setLlmProvider: (provider: 'gemini' | 'openai' | 'manual') => void;
  llmApiKey: string;
  setLlmApiKey: (key: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      showLyrics: false,
      toggleLyrics: () => set((state) => ({ showLyrics: !state.showLyrics })),
      themeColor: '#aa3bff',
      setThemeColor: (color: string) => set({ themeColor: color }),
      view: 'home',
      setView: (view) => set({ view }),
      showFps: false,
      toggleFps: () => set((state) => ({ showFps: !state.showFps })),
      lyricsStyle: 'dynamic',
      setLyricsStyle: (style) => set({ lyricsStyle: style }),
      dominantColor: null,
      setDominantColor: (color: string | null) => set({ dominantColor: color }),
      
      selectedAlbumId: '',
      setSelectedAlbumId: (id) => set({ selectedAlbumId: id }),
      selectedAlbumCover: '',
      setSelectedAlbumCover: (cover) => set({ selectedAlbumCover: cover }),
      
      selectedArtistId: '',
      setSelectedArtistId: (id) => set({ selectedArtistId: id }),
      selectedArtistCover: '',
      setSelectedArtistCover: (cover) => set({ selectedArtistCover: cover }),
      
      selectedPlaylistId: '',
      setSelectedPlaylistId: (id) => set({ selectedPlaylistId: id }),
      
      selectedGenre: '',
      setSelectedGenre: (genre) => set({ selectedGenre: genre }),

      llmProvider: 'gemini',
      setLlmProvider: (provider) => set({ llmProvider: provider }),
      llmApiKey: '',
      setLlmApiKey: (key) => set({ llmApiKey: key }),
    }),
    {
      name: 'ui-storage',
    }
  )
);
