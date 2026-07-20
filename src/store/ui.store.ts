import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ViewState = 'home' | 'artists' | 'albums' | 'tracks' | 'albumDetail' | 'settings' | 'artistDetail' | 'genres' | 'genreDetail' | 'playlists' | 'playlistDetail' | 'search' | 'downloader';
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

  llmProvider: 'openrouter' | 'manual';
  setLlmProvider: (provider: 'openrouter' | 'manual') => void;
  llmApiKey: string;
  setLlmApiKey: (key: string) => void;

  homeForYouData: any;
  setHomeForYouData: (data: any) => void;

  languageStrictness: number;
  setLanguageStrictness: (strictness: number) => void;

  sceneStrictness: number;
  setSceneStrictness: (strictness: number) => void;

  infiniteRadio: boolean;
  setInfiniteRadio: (enabled: boolean) => void;

  radioAlgorithm: 'star' | 'chain';
  setRadioAlgorithm: (algo: 'star' | 'chain') => void;
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

      llmProvider: 'openrouter',
      setLlmProvider: (provider) => set({ llmProvider: provider }),
      llmApiKey: '',
      setLlmApiKey: (key) => set({ llmApiKey: key }),

      homeForYouData: null,
      setHomeForYouData: (data) => set({ homeForYouData: data }),

      languageStrictness: 0.03,
      setLanguageStrictness: (strictness) => set({ languageStrictness: strictness }),

      sceneStrictness: 0.08,
      setSceneStrictness: (strictness) => set({ sceneStrictness: strictness }),

      infiniteRadio: false,
      setInfiniteRadio: (enabled) => set({ infiniteRadio: enabled }),

      radioAlgorithm: 'chain',
      setRadioAlgorithm: (algo) => set({ radioAlgorithm: algo }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => Object.fromEntries(
        Object.entries(state).filter(([key]) => key !== 'homeForYouData')
      ) as UIState,
    }
  )
);
