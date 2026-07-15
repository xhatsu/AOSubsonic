import { useState, useMemo, useEffect, useRef } from 'react';
import { useGetArtists, useGetAlbumList, useGetRandomSongsQuery, useGetAlbum, useSearchQuery, useGetArtistInfo2, useGetArtist, useGetGenres, useGetAlbumList2, useGetPlaylists, useGetPlaylist } from '../api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { SubsonicController } from '../api/subsonic';
import { usePlayerStore } from '../store/player.store';
import { useUIStore } from '../store/ui.store';
import { FiPlay, FiArrowLeft, FiSearch, FiX, FiMusic, FiTrash2, FiPlus, FiList, FiMoreHorizontal } from 'react-icons/fi';
import { CachedImage } from './CachedImage';
import { WikiImageFallback } from './WikiImageFallback';
import { Vibrant } from 'node-vibrant/browser';
import { getCacheSizeInMB, clearImageCache } from '../utils/imageCache';
import { AiPlaylistModal } from './AiPlaylistModal';
import { HomePage } from './HomePage';
import { useHistoryStore } from '../store/history.store';
import { DownloaderView } from './DownloaderView';
import { PlaybackSettings } from './PlaybackSettings';

export const MainContent = () => {
  const { 
    view, setView,
    themeColor, setThemeColor,
    selectedAlbumId, setSelectedAlbumId,
    selectedAlbumCover, setSelectedAlbumCover,
    selectedArtistId, setSelectedArtistId,
    selectedArtistCover, setSelectedArtistCover,
    selectedPlaylistId, setSelectedPlaylistId,
    selectedGenre, setSelectedGenre,
    llmProvider, setLlmProvider,
    llmApiKey, setLlmApiKey,
    llmModelName, setLlmModelName
  } = useUIStore();

  const [isAiPlaylistModalOpen, setIsAiPlaylistModalOpen] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const [historySize, setHistorySize] = useState<number>(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const refreshCacheSize = async () => {
    const size = await getCacheSizeInMB();
    setCacheSize(size);
    setHistorySize(useHistoryStore.getState().getHistorySizeKB() / 1024);
  };

  const handleClearCache = async () => {
    await clearImageCache();
    await refreshCacheSize();
  };

  useEffect(() => {
    refreshCacheSize();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery.length > 0) {
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sorting states
  const [artistSort, setArtistSort] = useState<'name-asc' | 'name-desc' | 'albums-desc'>('name-asc');
  const [albumSortType, setAlbumSortType] = useState<string>('random');
  const [trackSort, setTrackSort] = useState<'default' | 'title' | 'artist' | 'duration'>('default');

  // Pagination states
  const PAGE_SIZE = 40;
  const ARTIST_PAGE_SIZE = 40;

  const [albumPage, setAlbumPage] = useState(0);
  const [trackPage, setTrackPage] = useState(0);
  const [artistPage, setArtistPage] = useState(0);

  // Genre states
  const [genreAlbumPage, setGenreAlbumPage] = useState(0);

  // View history tracking
  const [lastView, setLastView] = useState<'albums' | 'genres' | 'genreDetail' | 'artists' | 'tracks' | 'playlists'>('albums');

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; tracks: any[] } | null>(null);
  const [playlistSearchQuery, setPlaylistSearchQuery] = useState('');

  const handleClick = () => {
    if (contextMenu?.visible) setContextMenu(null);
  };

  useEffect(() => {
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, item: any | any[]) => {
    e.preventDefault();
    setPlaylistSearchQuery('');
    setContextMenu({
      visible: true,
      x: e.pageX,
      y: e.pageY,
      tracks: Array.isArray(item) ? item : [item]
    });
  };

  const handleAddTracksToPlaylist = async (playlistId: string, trackIds: string[]) => {
    if (!ctrl || !trackIds.length) return;
    try {
      await ctrl.updatePlaylist(playlistId, undefined, undefined, undefined, trackIds);
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      alert('Added to playlist!');
    } catch (e) {
      console.error(e);
      alert('Failed to add to playlist');
    }
  };

  useEffect(() => {
    if (view !== 'albumDetail' && view !== 'artistDetail' && view !== 'settings' && view !== 'genreDetail' && view !== 'playlistDetail') {
      setLastView(view as any);
    }
  }, [view]);

  // Reset page numbers when parameters change
  useEffect(() => {
    setAlbumPage(0);
  }, [albumSortType]);

  useEffect(() => {
    setArtistPage(0);
  }, [artistSort]);

  useEffect(() => {
    setTrackPage(0);
  }, [trackSort]);

  useEffect(() => {
    setGenreAlbumPage(0);
  }, [selectedGenre]);

  const { data: artistsData, isLoading: isLoadingArtists } = useGetArtists();
  const { data: albumsData, isLoading: isLoadingAlbums } = useGetAlbumList(albumSortType, PAGE_SIZE, albumPage * PAGE_SIZE);
  const { data: tracksData, isLoading: isLoadingTracks } = useGetRandomSongsQuery(PAGE_SIZE, trackPage * PAGE_SIZE);
  const { data: albumDetailData, isLoading: isLoadingAlbumDetail } = useGetAlbum(selectedAlbumId);
  const { data: artistDetailData, isLoading: isLoadingArtistDetail } = useGetArtist(selectedArtistId);
  const { data: artistInfoData, isLoading: isLoadingArtistInfo } = useGetArtistInfo2(selectedArtistId);
  const { data: searchData, isLoading: isLoadingSearch } = useSearchQuery(debouncedSearchQuery);

  const { data: playlistsData, isLoading: isLoadingPlaylists } = useGetPlaylists();
  const { data: playlistDetailData, isLoading: isLoadingPlaylistDetail } = useGetPlaylist(selectedPlaylistId || null);
  const queryClient = useQueryClient();

  // Genres query hooks
  const { data: genresData, isLoading: isLoadingGenres } = useGetGenres();
  const { data: genreAlbumsData, isLoading: isLoadingGenreAlbums } = useGetAlbumList2(
    'byGenre',
    PAGE_SIZE,
    genreAlbumPage * PAGE_SIZE,
    selectedGenre ? { genre: selectedGenre } : undefined
  );

  const config = useAuthStore(state => state.config);
  const queue = usePlayerStore(state => state.queue);
  const currentIndex = usePlayerStore(state => state.currentIndex);
  const currentSong = queue[currentIndex];
  
  const setQueue = usePlayerStore(state => state.setQueue);
  const play = usePlayerStore(state => state.play);
  const addToQueue = usePlayerStore(state => state.addToQueue);
  const addListToQueue = usePlayerStore(state => state.addListToQueue);

  const getController = () => config ? new SubsonicController(config) : null;
  const ctrl = getController();

  const handlePlayRandom = async () => {
    if (!ctrl) return;
    try {
      let songsToPlay: any[] = [];

      // Determine what to play based on what's currently showing on screen
      if (view === 'tracks' && tracksData?.randomSongs?.song) {
        // Shuffle the tracks currently on screen
        const currentTracks = tracksData.randomSongs.song;
        songsToPlay = [...currentTracks];
      } else if (view === 'genreDetail') {
        const data = await ctrl.getRandomSongs(20, 0, selectedGenre);
        const rawSongs = data.randomSongs?.song;
        songsToPlay = rawSongs ? (Array.isArray(rawSongs) ? rawSongs : [rawSongs]) : [];
      } else if (view === 'albums') {
        const data = await ctrl.getRandomSongs(20);
        const rawSongs = data.randomSongs?.song;
        songsToPlay = rawSongs ? (Array.isArray(rawSongs) ? rawSongs : [rawSongs]) : [];
      } else if (view === 'artists' && artistsData?.artists?.index) {
        // Pick a random artist showing on screen, then fetch one of their albums
        const indices = artistsData.artists.index;
        const allArtists = indices.flatMap((i: any) => i.artist || []);
        if (allArtists.length > 0) {
          const randomArtist = allArtists[Math.floor(Math.random() * allArtists.length)];
          const resArtist = await ctrl.getArtist(randomArtist.id);
          const rawAlbums = resArtist.artist?.album;
          const artistAlbums = rawAlbums ? (Array.isArray(rawAlbums) ? rawAlbums : [rawAlbums]) : [];
          if (artistAlbums.length > 0) {
            const randomAlbum = artistAlbums[Math.floor(Math.random() * artistAlbums.length)];
            const resAlbum = await ctrl.getAlbum(randomAlbum.id);
            const rawSongs = resAlbum.album?.song;
            songsToPlay = rawSongs ? (Array.isArray(rawSongs) ? rawSongs : [rawSongs]) : [];
          }
        }
      } else if (view === 'albumDetail' && albumDetailData?.album?.song) {
        const rawSongs = albumDetailData.album.song;
        songsToPlay = Array.isArray(rawSongs) ? rawSongs : [rawSongs];
      } else if (view === 'artistDetail' && artistDetailData?.artist?.album) {
         const rawAlbums = artistDetailData.artist.album;
         const artistAlbums = Array.isArray(rawAlbums) ? rawAlbums : [rawAlbums];
         if (artistAlbums.length > 0) {
            const randomAlbum = artistAlbums[Math.floor(Math.random() * artistAlbums.length)];
            const resAlbum = await ctrl.getAlbum(randomAlbum.id);
            const rawSongs = resAlbum.album?.song;
            songsToPlay = rawSongs ? (Array.isArray(rawSongs) ? rawSongs : [rawSongs]) : [];
         }
      } else {
        // Fallback to server-wide random if nothing is showing
        const data = await ctrl.getRandomSongs(20);
        songsToPlay = data.randomSongs?.song || [];
      }

      if (songsToPlay.length > 0) {
        // Shuffle the chosen songs
        const shuffled = [...songsToPlay].sort(() => 0.5 - Math.random());
        const mappedQueue = shuffled.map((song: any) => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          streamUrl: ctrl.getStreamUrl(song.id),
          coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
        }));

        setQueue(mappedQueue, 0);
        play();
      } else {
        alert("No items found to play on this screen.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to play random songs.");
    }
  };

  const handleOpenArtist = (artistId: string, coverArt?: string) => {
    setSelectedArtistId(artistId);
    setSelectedArtistCover(coverArt || artistId);
    setView('artistDetail');
  };

  const handleOpenAlbum = (albumId: string, coverArt?: string) => {
    setSelectedAlbumId(albumId);
    setSelectedAlbumCover(coverArt || albumId);
    setView('albumDetail');
  };

  const handleOpenPlaylist = (playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setView('playlistDetail');
  };

  const handleCreatePlaylist = async () => {
    if (!ctrl) return;
    const name = prompt('Enter new playlist name:');
    if (!name) return;
    try {
      await ctrl.createPlaylist(name);
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
    } catch (e) {
      console.error(e);
      alert('Failed to create playlist');
    }
  };

  const handleCreatePlaylistFromGenre = async (genre: string) => {
    if (!ctrl) return;
    const name = prompt('Enter new playlist name:', `${genre} Mix`);
    if (!name) return;
    
    try {
      const data = await ctrl.getSongsByGenre(genre, 500, 0);
      const rawSongs = data.songsByGenre?.song;
      const songs = rawSongs ? (Array.isArray(rawSongs) ? rawSongs : [rawSongs]) : [];
      
      if (songs.length === 0) {
        alert('No songs found for this genre to add.');
        return;
      }
      
      const songIds = songs.map((s: any) => s.id);
      await ctrl.createPlaylist(name, songIds);
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      alert(`Created playlist "${name}" with ${songs.length} songs!`);
    } catch (e) {
      console.error(e);
      alert('Failed to create playlist from genre');
    }
  };

  const handleDeletePlaylist = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!ctrl) return;
    if (!confirm('Are you sure you want to delete this playlist?')) return;
    try {
      await ctrl.deletePlaylist(id);
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      if (view === 'playlistDetail' && selectedPlaylistId === id) {
        setView('playlists');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to delete playlist');
    }
  };

  const handleRemoveFromPlaylist = async (playlistId: string, index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!ctrl) return;
    try {
      await ctrl.updatePlaylist(playlistId, undefined, undefined, undefined, undefined, index);
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
    } catch (e) {
      console.error(e);
      alert('Failed to remove song');
    }
  };

  const handleAddQueueToPlaylist = async (playlistId: string) => {
    if (!ctrl) return;
    const songIds = queue.map(s => s.id);
    if (songIds.length === 0) return alert('Queue is empty');
    try {
      await ctrl.updatePlaylist(playlistId, undefined, undefined, undefined, songIds);
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] });
      alert('Added queue to playlist!');
    } catch (e) {
      console.error(e);
      alert('Failed to add queue to playlist');
    }
  };

  const handlePlayAlbumList = (songs: any[], startIndex: number = 0) => {
    if (!ctrl) return;
    const mappedQueue = songs.map((song: any) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      streamUrl: ctrl.getStreamUrl(song.id),
      coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
    }));
    setQueue(mappedQueue, startIndex);
    play();
  };

  const handleAddToQueue = (e: React.MouseEvent, song: any) => {
    e.stopPropagation();
    if (!ctrl) return;
    addToQueue({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      streamUrl: ctrl.getStreamUrl(song.id),
      coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
    });
  };

  const handleAddTracksToQueue = (e: React.MouseEvent, tracks: any[]) => {
    e.stopPropagation();
    if (!ctrl || !tracks.length) return;
    const mapped = tracks.map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      streamUrl: ctrl.getStreamUrl(song.id),
      coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
    }));
    addListToQueue(mapped);
  };

  // Sorted Artists
  const sortedArtists = useMemo(() => {
    const indices = artistsData?.artists?.index || [];
    const all = indices.flatMap((i: any) => i.artist || []);
    return all.sort((a: any, b: any) => {
      if (artistSort === 'name-asc') return a.name.localeCompare(b.name);
      if (artistSort === 'name-desc') return b.name.localeCompare(a.name);
      if (artistSort === 'albums-desc') return (b.albumCount || 0) - (a.albumCount || 0);
      return 0;
    });
  }, [artistsData, artistSort]);

  // Client-side paginated artists
  const paginatedArtists = useMemo(() => {
    const start = artistPage * ARTIST_PAGE_SIZE;
    return sortedArtists.slice(start, start + ARTIST_PAGE_SIZE);
  }, [sortedArtists, artistPage]);

  // Sorted Tracks (Albums are sorted by the API param)
  const sortedTracks = useMemo(() => {
    const all = tracksData?.randomSongs?.song || [];
    if (trackSort === 'default') return all;
    return [...all].sort((a: any, b: any) => {
      if (trackSort === 'title') return a.title.localeCompare(b.title);
      if (trackSort === 'artist') return (a.artist || '').localeCompare(b.artist || '');
      if (trackSort === 'duration') return (b.duration || 0) - (a.duration || 0);
      return 0;
    });
  }, [tracksData, trackSort]);

  const PaginationBar = ({ page, setPage, hasMore, totalLabel }: {
    page: number;
    setPage: (p: number) => void;
    hasMore: boolean;
    totalLabel?: string;
  }) => (
    <div className="flex items-center justify-center space-x-4 mt-8 pb-6 flex-shrink-0">
      <button
        onClick={() => {
          setPage(Math.max(0, page - 1));
          const main = document.querySelector('.flex-1.overflow-y-auto');
          if (main) main.scrollTop = 0;
        }}
        disabled={page === 0}
        className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white border border-white/5 transition-all shadow-md active:scale-95 cursor-pointer"
      >
        Previous
      </button>
      <span className="text-zinc-400 text-sm font-medium">Page {page + 1}{totalLabel}</span>
      <button
        onClick={() => {
          setPage(page + 1);
          const main = document.querySelector('.flex-1.overflow-y-auto');
          if (main) main.scrollTop = 0;
        }}
        disabled={!hasMore}
        className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white border border-white/5 transition-all shadow-md active:scale-95 cursor-pointer"
      >
        Next
      </button>
    </div>
  );

  const renderArtists = () => {
    if (isLoadingArtists) return <div className="text-zinc-400 mt-4">Loading artists...</div>;
    if (sortedArtists.length === 0) return <div className="text-zinc-400 mt-4">No artists found.</div>;
    const hasMore = (artistPage + 1) * ARTIST_PAGE_SIZE < sortedArtists.length;
    return (
      <div className="flex flex-col flex-1">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
          {paginatedArtists.map((artist: any) => (
            <div key={artist.id} className="group cursor-pointer p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors" onClick={() => handleOpenArtist(artist.id, artist.artistImageUrl || artist.coverArt)}>
              <div className="aspect-square bg-zinc-700 rounded-full mb-4 shadow-lg group-hover:shadow-xl transition-shadow flex items-center justify-center overflow-hidden">
                {artist.artistImageUrl ? (
                  <CachedImage id={`artist_${artist.id}`} url={artist.artistImageUrl} alt={artist.name} className="w-full h-full object-cover" />
                ) : artist.coverArt && ctrl ? (
                  <CachedImage id={artist.coverArt} url={ctrl.getCoverArtUrl(artist.coverArt)} alt={artist.name} className="w-full h-full object-cover" />
                ) : (
                  <WikiImageFallback artistName={artist.name} className="w-full h-full" />
                )}
              </div>
              <h3 className="font-semibold text-white truncate text-center">{artist.name}</h3>
              <p className="text-zinc-400 text-sm text-center mt-1">{artist.albumCount} albums</p>
            </div>
          ))}
        </div>
        <PaginationBar
          page={artistPage}
          setPage={setArtistPage}
          hasMore={hasMore}
          totalLabel={` of ${Math.ceil(sortedArtists.length / ARTIST_PAGE_SIZE)}`}
        />
      </div>
    );
  };

  const renderAlbums = () => {
    if (isLoadingAlbums) return <div className="text-zinc-400 mt-4">Loading albums...</div>;
    const allAlbums = albumsData?.albumList?.album || [];
    if (allAlbums.length === 0) return <div className="text-zinc-400 mt-4">No albums found.</div>;
    const hasMore = allAlbums.length === PAGE_SIZE;
    return (
      <div className="flex flex-col flex-1">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
          {allAlbums.map((album: any) => (
            <div key={album.id} className="group cursor-pointer p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors" onClick={() => handleOpenAlbum(album.id, album.coverArt)}>
              <div className="aspect-square bg-zinc-700 rounded-lg mb-4 shadow-lg group-hover:shadow-xl transition-shadow flex items-center justify-center overflow-hidden">
                {album.coverArt && ctrl ? (
                  <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl text-zinc-500">{album.title?.charAt(0)}</span>
                )}
              </div>
              <h3 className="font-semibold text-white truncate">{album.title}</h3>
              <p className="text-zinc-400 text-sm truncate mt-1">{album.artist}</p>
            </div>
          ))}
        </div>
        <PaginationBar
          page={albumPage}
          setPage={setAlbumPage}
          hasMore={hasMore}
        />
      </div>
    );
  };

  const renderTracks = () => {
    if (isLoadingTracks) return <div className="text-zinc-400 mt-4">Loading tracks...</div>;
    if (sortedTracks.length === 0) return <div className="text-zinc-400 mt-4">No tracks found.</div>;
    const hasMore = sortedTracks.length === PAGE_SIZE;
    return (
      <div className="flex flex-col flex-1">
        <div className="flex flex-col space-y-2 mt-6">
          {sortedTracks.map((track: any, index: number) => (
            <div key={track.id} onContextMenu={(e) => handleContextMenu(e, track)} onClick={() => handlePlayAlbumList(sortedTracks, index)} className="group flex items-center p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
              <div className="w-12 h-12 bg-zinc-800 rounded flex-shrink-0 flex items-center justify-center relative overflow-hidden mr-4">
                {track.coverArt && ctrl ? (
                  <CachedImage id={track.coverArt} url={ctrl.getCoverArtUrl(track.coverArt)} alt={track.title} className="w-full h-full object-cover" />
                ) : <FiPlay className="text-zinc-500" />}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <FiPlay className="text-white text-xl" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium truncate">{track.title}</h4>
                <p className="text-zinc-400 text-sm truncate">{track.artist} • {track.album}</p>
              </div>
              <div className="flex items-center justify-end w-24 space-x-2 text-zinc-500 text-sm">
                <span>{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</span>
                <button
                  onClick={(e) => handleAddToQueue(e, track)}
                  className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Add to queue"
                >
                  <FiPlus />
                </button>
              </div>
            </div>
          ))}
        </div>
        <PaginationBar
          page={trackPage}
          setPage={setTrackPage}
          hasMore={hasMore}
        />
      </div>
    );
  };

  const renderSearchDropdown = () => {
    if (!showDropdown || debouncedSearchQuery.length === 0) return null;

    return (
      <div className="absolute top-full left-0 mt-2 w-[32rem] max-h-[70vh] overflow-y-auto bg-zinc-800/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl z-[200] p-4">
        {isLoadingSearch ? (
          <div className="text-zinc-400 text-center py-4">Searching...</div>
        ) : (
          (() => {
            const results = searchData?.searchResult3;
            if (!results || (!results.artist && !results.album && !results.song)) {
              return <div className="text-zinc-400 text-center py-4">No results found for "{debouncedSearchQuery}".</div>;
            }

            const ensureArray = (data: any) => {
              if (!data) return [];
              if (Array.isArray(data)) return data;
              return [data];
            };

            const searchArtists = ensureArray(results.artist);
            const searchAlbums = ensureArray(results.album);
            const searchSongs = ensureArray(results.song);

            return (
              <div className="flex flex-col space-y-6">
                {searchArtists.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 px-2">Artists</h3>
                    <div className="flex flex-col space-y-1">
                      {searchArtists.slice(0, 5).map((artist: any) => (
                        <div
                          key={artist.id}
                          className="flex items-center space-x-3 p-2 hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors"
                          onClick={() => {
                            setShowDropdown(false);
                            handleOpenArtist(artist.id, artist.artistImageUrl || artist.coverArt);
                          }}
                        >
                          <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {artist.artistImageUrl ? (
                              <CachedImage id={`artist_search_${artist.id}`} url={artist.artistImageUrl} alt={artist.name} className="w-full h-full object-cover" />
                            ) : artist.coverArt && ctrl ? (
                              <CachedImage id={artist.coverArt} url={ctrl.getCoverArtUrl(artist.coverArt)} alt={artist.name} className="w-full h-full object-cover" />
                            ) : (
                              <WikiImageFallback artistName={artist.name} className="w-full h-full text-lg" />
                            )}
                          </div>
                          <span className="text-white font-medium truncate">{artist.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchSongs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 px-2">Tracks</h3>
                    <div className="flex flex-col space-y-1">
                      {searchSongs.slice(0, 10).map((track: any, index: number) => (
                        <div
                          key={track.id}
                          onContextMenu={(e) => handleContextMenu(e, track)}
                          className="group flex items-center p-2 hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors"
                          onClick={() => {
                            setShowDropdown(false);
                            handlePlayAlbumList(results.song, index);
                          }}
                        >
                          <div className="w-10 h-10 bg-zinc-700 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden mr-3">
                            {track.coverArt && ctrl ? (
                              <CachedImage id={track.coverArt} url={ctrl.getCoverArtUrl(track.coverArt)} alt={track.title} className="w-full h-full object-cover" />
                            ) : (
                              <FiMusic className="text-zinc-500" />
                            )}
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <FiPlay className="text-white" />
                            </div>
                          </div>
                          <div className="flex-col min-w-0 flex-1">
                            <div className="text-white font-medium truncate">{track.title}</div>
                            <div className="text-xs text-zinc-400 truncate">{track.artist}</div>
                          </div>
                          <div className="flex items-center space-x-2 text-xs text-zinc-500 ml-2 flex-shrink-0">
                            <span>{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</span>
                            <button
                              onClick={(e) => handleAddToQueue(e, track)}
                              className="p-1 hover:bg-zinc-600 rounded text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                              title="Add to queue"
                            >
                              <FiPlus className="text-sm" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchAlbums.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 px-2">Albums</h3>
                    <div className="flex flex-col space-y-1">
                      {searchAlbums.slice(0, 5).map((album: any) => (
                        <div
                          key={album.id}
                          className="flex items-center space-x-3 p-2 hover:bg-zinc-700/50 rounded-lg cursor-pointer transition-colors"
                          onClick={() => {
                            setShowDropdown(false);
                            handleOpenAlbum(album.id, album.coverArt);
                          }}
                        >
                          <div className="w-10 h-10 bg-zinc-700 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {album.coverArt && ctrl ? (
                              <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg text-zinc-400">{album.title?.charAt(0)}</span>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-white font-medium truncate">{album.title}</span>
                            <span className="text-xs text-zinc-400 truncate">{album.artist}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}
      </div>
    );
  };

  const renderGenres = () => {
    if (isLoadingGenres) return <div className="text-zinc-400 mt-4">Loading genres...</div>;
    const genres = genresData?.genres?.genre || [];
    if (genres.length === 0) return <div className="text-zinc-400 mt-4">No genres found.</div>;

    // Sort by album count descending
    const sortedGenres = [...genres].sort((a: any, b: any) => (b.albumCount || 0) - (a.albumCount || 0));

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
        {sortedGenres.map((genre: any) => (
          <div
            key={genre.value}
            onClick={() => {
              setSelectedGenre(genre.value);
              setView('genreDetail');
            }}
            className="group cursor-pointer p-6 bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 hover:from-primary/20 hover:to-zinc-800 rounded-xl transition-all border border-zinc-700/30 hover:border-primary/30"
          >
            <h3 className="font-bold text-white text-lg mb-1">{genre.value}</h3>
            <p className="text-zinc-400 text-sm">{genre.albumCount} album{genre.albumCount !== 1 ? 's' : ''} • {genre.songCount} track{genre.songCount !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderGenreDetail = () => {
    if (isLoadingGenreAlbums) return <div className="text-zinc-400 mt-4">Loading genre details...</div>;
    
    const albums = genreAlbumsData?.albumList2?.album || [];
    const hasMore = albums.length === PAGE_SIZE;

    return (
      <div className="flex flex-col mt-4 pb-10 flex-1">
        <button
          onClick={() => setView('genres')}
          className="flex items-center text-white hover:text-white/80 font-medium mb-6 w-fit transition-colors drop-shadow-md"
        >
          <FiArrowLeft className="mr-2" /> Back to Genres
        </button>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold text-white">Genre: {selectedGenre}</h2>
          <button 
            onClick={() => handleCreatePlaylistFromGenre(selectedGenre)}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-zinc-700/50 flex items-center shadow-lg active:scale-95 cursor-pointer"
          >
            <FiPlus className="mr-2" /> Create Playlist Mix
          </button>
        </div>

        {albums.length === 0 ? (
          <div className="text-zinc-400 mt-4">No albums found for this genre.</div>
        ) : (
          <div className="flex flex-col flex-1">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
              {albums.map((album: any) => (
                <div
                  key={album.id}
                  className="group cursor-pointer p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors"
                  onClick={() => handleOpenAlbum(album.id, album.coverArt)}
                >
                  <div className="aspect-square bg-zinc-700 rounded-lg mb-4 shadow-lg group-hover:shadow-xl transition-shadow flex items-center justify-center overflow-hidden">
                    {album.coverArt && ctrl ? (
                      <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl text-zinc-500">{album.title?.charAt(0)}</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white truncate">{album.title}</h3>
                  <p className="text-zinc-400 text-sm truncate mt-1">{album.artist}</p>
                </div>
              ))}
            </div>
            <PaginationBar
              page={genreAlbumPage}
              setPage={setGenreAlbumPage}
              hasMore={hasMore}
            />
          </div>
        )}
      </div>
    );
  };

  const renderAlbumDetail = () => {
    if (isLoadingAlbumDetail) return <div className="text-zinc-400 mt-4">Loading album details...</div>;
    const album = albumDetailData?.album;
    if (!album) return <div className="text-zinc-400 mt-4">Album not found.</div>;
    const songs = album.song || [];

    return (
      <div className="flex flex-col mt-4 pb-10">
        <button onClick={() => setView(lastView === 'genreDetail' ? 'genreDetail' : 'albums')} className="flex items-center text-white hover:text-white/80 font-medium mb-6 w-fit transition-colors drop-shadow-md">
          <FiArrowLeft className="mr-2" /> Back to {lastView === 'genreDetail' ? 'Genre' : 'Albums'}
        </button>

        <div className="flex items-end space-x-6 mb-8 mt-4 relative z-10">
          <div 
            className="w-48 h-48 bg-zinc-800 rounded-lg shadow-2xl overflow-hidden flex-shrink-0 relative"
            style={{
              boxShadow: dominantColor ? `0 20px 40px -10px ${dominantColor}66` : undefined
            }}
          >
            {album.coverArt && ctrl ? (
              <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 text-6xl">
                {album.title?.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-4xl font-bold text-white mb-2">{album.title}</h2>
            <p className="text-zinc-400 text-lg mb-4">{album.artist} • {songs.length} tracks</p>
            <div className="flex space-x-4">
              <button onClick={() => handlePlayAlbumList(songs, 0)} className="bg-primary hover:bg-purple-600 text-white px-6 py-3 rounded-full font-bold transition-colors flex items-center">
                <FiPlay className="mr-2" /> Play Album
              </button>
              <button onClick={() => {
                if (!ctrl) return;
                const mappedQueue = songs.map((song: any) => ({
                  id: song.id,
                  title: song.title,
                  artist: song.artist,
                  album: song.album,
                  duration: song.duration,
                  streamUrl: ctrl.getStreamUrl(song.id),
                  coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
                }));
                addListToQueue(mappedQueue);
              }} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-full font-bold transition-colors flex items-center border border-zinc-700/50">
                <FiPlus className="mr-2 text-zinc-400" /> Add to Queue
              </button>
              <button onClick={(e) => handleContextMenu(e, songs)} className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-full font-bold transition-colors flex items-center border border-zinc-700/50" title="More Options">
                <FiMoreHorizontal className="text-xl text-zinc-400" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          {songs.map((track: any, index: number) => (
            <div key={track.id} onContextMenu={(e) => handleContextMenu(e, track)} onClick={() => handlePlayAlbumList(songs, index)} className="group flex items-center p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
              <div className="w-8 text-center text-zinc-500 group-hover:hidden">{index + 1}</div>
              <div className="w-8 text-center text-white hidden group-hover:block"><FiPlay /></div>
              <div className="flex-1 min-w-0 ml-4">
                <h4 className="text-white font-medium truncate">{track.title}</h4>
              </div>
              <div className="flex items-center justify-end w-24 space-x-2 text-zinc-500 text-sm">
                <span>{Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}</span>
                <button
                  onClick={(e) => handleAddToQueue(e, track)}
                  className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-white transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  title="Add to queue"
                >
                  <FiPlus />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderArtistDetail = () => {
    if (isLoadingArtistDetail || isLoadingArtistInfo) return <div className="text-zinc-400 mt-4">Loading artist details...</div>;

    const rawAlbums = artistDetailData?.artist?.album;
    const artistAlbums = rawAlbums ? (Array.isArray(rawAlbums) ? rawAlbums : [rawAlbums]) : [];
    const artistInfo = artistInfoData?.artistInfo2;
    const artistName = artistDetailData?.artist?.name || 'Unknown Artist';

    return (
      <div className="flex flex-col mt-4 pb-10">
        <button onClick={() => setView('artists')} className="flex items-center text-white hover:text-white/80 font-medium mb-6 w-fit transition-colors drop-shadow-md">
          <FiArrowLeft className="mr-2" /> Back to Artists
        </button>

        {/* Artist Header */}
        <div className="flex flex-col md:flex-row md:items-end space-y-6 md:space-y-0 md:space-x-8 mb-12">
          <div className="w-48 h-48 md:w-64 md:h-64 rounded-full shadow-2xl overflow-hidden flex-shrink-0 bg-zinc-800 border-4 border-zinc-900">
            {artistInfo?.largeImageUrl || artistInfo?.mediumImageUrl ? (
              <CachedImage
                id={`artist_${selectedArtistId}`}
                url={artistInfo.largeImageUrl || artistInfo.mediumImageUrl}
                alt={artistName}
                className="w-full h-full object-cover"
              />
            ) : (
              <WikiImageFallback artistName={artistName} className="w-full h-full text-6xl" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tighter">{artistName}</h2>
            {artistInfo?.biography && (
              <div className="text-zinc-400 text-sm max-h-32 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                <div dangerouslySetInnerHTML={{ __html: artistInfo.biography }} />
              </div>
            )}
          </div>
        </div>

        {/* Albums Grid */}
        <h3 className="text-2xl font-bold text-white mb-6">Albums</h3>
        {artistAlbums.length === 0 ? (
          <div className="text-zinc-400">No albums found for this artist.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {artistAlbums.map((album: any) => (
              <div key={album.id} className="group cursor-pointer p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors" onClick={() => handleOpenAlbum(album.id, album.coverArt)}>
                <div className="aspect-square bg-zinc-700 rounded-lg mb-4 shadow-lg group-hover:shadow-xl transition-shadow flex items-center justify-center overflow-hidden">
                  {album.coverArt && ctrl ? (
                    <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-4xl text-zinc-500">{album.title?.charAt(0)}</span>
                  )}
                </div>
                <h3 className="font-semibold text-white truncate">{album.title}</h3>
                <p className="text-zinc-400 text-sm truncate mt-1">{album.year || 'Unknown Year'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Similar Artists */}
        {artistInfo?.similarArtist && (
          <div className="mt-12">
            <h3 className="text-xl font-bold text-white mb-6">Similar Artists</h3>
            <div className="flex space-x-6 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              {(Array.isArray(artistInfo.similarArtist) ? artistInfo.similarArtist : [artistInfo.similarArtist]).map((similar: any) => (
                <div key={similar.id} className="flex flex-col items-center cursor-pointer w-32 flex-shrink-0 group" onClick={() => handleOpenArtist(similar.id, similar.mediumImageUrl || similar.coverArt)}>
                  <div className="w-24 h-24 rounded-full bg-zinc-800 overflow-hidden mb-3 group-hover:ring-4 ring-primary/50 transition-all">
                    {similar.mediumImageUrl ? (
                      <CachedImage
                        id={`artist_${similar.id}`}
                        url={similar.mediumImageUrl}
                        alt={similar.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <WikiImageFallback artistName={similar.name} className="w-full h-full text-2xl" />
                    )}
                  </div>
                  <span className="text-zinc-300 text-sm font-medium text-center truncate w-full group-hover:text-white transition-colors">{similar.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPlaylists = () => {
    if (isLoadingPlaylists) return <div className="text-zinc-400 mt-4">Loading playlists...</div>;
    const playlists = playlistsData?.playlists?.playlist || [];
    const allPlaylists = Array.isArray(playlists) ? playlists : (playlists ? [playlists] : []);

    return (
      <div className="flex flex-col flex-1 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          <div onClick={handleCreatePlaylist} className="group cursor-pointer p-4 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-xl transition-colors border border-dashed border-zinc-700 hover:border-primary/50 flex flex-col items-center justify-center min-h-[240px]">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FiPlus className="text-2xl text-zinc-400 group-hover:text-primary" />
            </div>
            <h3 className="font-semibold text-white">Create Playlist</h3>
          </div>
          
          <div onClick={() => setIsAiPlaylistModalOpen(true)} className="group cursor-pointer p-4 bg-zinc-800/30 hover:bg-zinc-800/60 rounded-xl transition-colors border border-dashed border-primary/30 hover:border-primary/70 flex flex-col items-center justify-center min-h-[240px] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-16 h-16 rounded-full bg-zinc-800 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative z-10">
              <FiMusic className="text-2xl text-primary" />
            </div>
            <h3 className="font-semibold text-white relative z-10">AI Playlist</h3>
            <p className="text-zinc-400 text-xs mt-2 text-center px-2 relative z-10">Create with LLM prompt</p>
          </div>

          {allPlaylists.map((pl: any) => (
            <div key={pl.id} className="group cursor-pointer p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors relative" onClick={() => handleOpenPlaylist(pl.id)}>
              <div className="aspect-square bg-zinc-700 rounded-lg mb-4 shadow-lg group-hover:shadow-xl transition-shadow flex items-center justify-center overflow-hidden">
                {pl.coverArt && ctrl ? (
                  <CachedImage id={pl.coverArt} url={ctrl.getCoverArtUrl(pl.coverArt)} alt={pl.name} className="w-full h-full object-cover" />
                ) : (
                  <FiList className="text-4xl text-zinc-500" />
                )}
              </div>
              <h3 className="font-semibold text-white truncate pr-8">{pl.name}</h3>
              <p className="text-zinc-400 text-sm mt-1">{pl.songCount} tracks</p>
              
              <button 
                onClick={(e) => handleDeletePlaylist(pl.id, e)}
                className="absolute bottom-5 right-4 p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-zinc-700"
                title="Delete Playlist"
              >
                <FiTrash2 />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPlaylistDetail = () => {
    if (isLoadingPlaylistDetail) return <div className="text-zinc-400 mt-4">Loading playlist...</div>;
    const playlist = playlistDetailData?.playlist;
    if (!playlist) return <div className="text-zinc-400 mt-4">Playlist not found.</div>;
    const songs = playlist.entry || [];
    const songArray = Array.isArray(songs) ? songs : (songs ? [songs] : []);

    return (
      <div className="flex flex-col mt-4 pb-10">
        <button onClick={() => setView('playlists')} className="flex items-center text-white hover:text-white/80 font-medium mb-6 w-fit transition-colors drop-shadow-md">
          <FiArrowLeft className="mr-2" /> Back to Playlists
        </button>

        <div className="flex items-end space-x-6 mb-8 mt-4 relative z-10">
          <div className="w-48 h-48 bg-zinc-800 rounded-lg shadow-2xl overflow-hidden flex-shrink-0 flex items-center justify-center">
            {playlist.coverArt && ctrl ? (
              <CachedImage id={playlist.coverArt} url={ctrl.getCoverArtUrl(playlist.coverArt)} alt={playlist.name} className="w-full h-full object-cover" />
            ) : (
              <FiList className="text-6xl text-zinc-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-4xl font-bold text-white mb-2">{playlist.name}</h2>
            <p className="text-zinc-400 text-lg mb-4">{songArray.length} tracks • {Math.floor((playlist.duration || 0) / 60)} minutes</p>
            <div className="flex space-x-4">
              <button onClick={() => handlePlayAlbumList(songArray, 0)} className="bg-primary hover:bg-purple-600 text-white px-6 py-3 rounded-full font-bold transition-colors flex items-center" disabled={songArray.length === 0}>
                <FiPlay className="mr-2" /> Play All
              </button>
              <button onClick={() => handleAddQueueToPlaylist(playlist.id)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-3 rounded-full font-bold transition-colors flex items-center border border-zinc-700/50">
                <FiPlus className="mr-2" /> Add Queue to Playlist
              </button>
              <button onClick={(e) => handleDeletePlaylist(playlist.id, e)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-3 rounded-full font-bold transition-colors flex items-center">
                <FiTrash2 className="mr-2" /> Delete Playlist
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          {songArray.length === 0 && <div className="text-zinc-400 py-4">This playlist is empty.</div>}
          {songArray.map((track: any, index: number) => (
            <div key={`${track.id}-${index}`} onContextMenu={(e) => handleContextMenu(e, track)} onClick={() => handlePlayAlbumList(songArray, index)} className="group flex items-center p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
              <div className="w-8 text-center text-zinc-500 group-hover:hidden">{index + 1}</div>
              <div className="w-8 text-center text-white hidden group-hover:block"><FiPlay /></div>
              
              <div className="w-10 h-10 bg-zinc-800 rounded flex-shrink-0 flex items-center justify-center overflow-hidden mx-3">
                {track.coverArt && ctrl ? (
                  <CachedImage id={track.coverArt} url={ctrl.getCoverArtUrl(track.coverArt)} alt={track.title} className="w-full h-full object-cover" />
                ) : <FiMusic className="text-zinc-500" />}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-white font-medium truncate">{track.title}</h4>
                <p className="text-zinc-400 text-sm truncate">{track.artist} • {track.album}</p>
              </div>
              <div className="flex items-center justify-end space-x-2 text-zinc-500 text-sm">
                <span>{Math.floor((track.duration || 0) / 60)}:{((track.duration || 0) % 60).toString().padStart(2, '0')}</span>
                <button
                  onClick={(e) => handleRemoveFromPlaylist(playlist.id, index, e)}
                  className="p-2 hover:bg-zinc-700 rounded-full text-zinc-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from playlist"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Background Color Extraction
  const dominantColor = useUIStore(state => state.dominantColor);
  const setDominantColor = useUIStore(state => state.setDominantColor);

  // Determine dynamic background image URL
  let backgroundImageUrl = null;
  if (view === 'albumDetail' && selectedAlbumCover && ctrl) {
    backgroundImageUrl = selectedAlbumCover.startsWith('http') ? selectedAlbumCover : ctrl.getCoverArtUrl(selectedAlbumCover);
  } else if (view === 'artistDetail' && selectedArtistCover && ctrl) {
    backgroundImageUrl = selectedArtistCover.startsWith('http') ? selectedArtistCover : ctrl.getCoverArtUrl(selectedArtistCover);
  } else if (currentSong?.coverArtUrl) {
    // Fallback to currently playing song
    backgroundImageUrl = currentSong.coverArtUrl;
  }

  useEffect(() => {
    if (!backgroundImageUrl) {
      setDominantColor(null);
      return;
    }

    const cacheKey = `dominant_color_${backgroundImageUrl}`;
    const cachedColor = localStorage.getItem(cacheKey);

    if (cachedColor) {
      setDominantColor(cachedColor);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = backgroundImageUrl;
    
    img.onload = () => {
      Vibrant.from(img).getPalette()
        .then(palette => {
          let hex = null;
          if (palette.Vibrant) {
            hex = palette.Vibrant.hex;
          } else if (palette.Muted) {
            hex = palette.Muted.hex;
          }
          
          if (hex) {
            if (hex !== cachedColor) {
              setDominantColor(hex);
              localStorage.setItem(cacheKey, hex);
            }
          } else if (!cachedColor) {
            setDominantColor(null);
          }
        })
        .catch(err => {
          console.error('Error extracting color:', err);
          if (!cachedColor) setDominantColor(null);
        });
    };
    
    img.onerror = () => {
      console.error('Error loading image for color extraction');
      if (!cachedColor) setDominantColor(null);
    };
  }, [backgroundImageUrl]);

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-900 flex flex-col relative">

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col flex-1 p-8">
      {view === 'settings' ? (
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-white mb-8">Settings</h2>
          <div className="max-w-2xl bg-zinc-800/50 rounded-2xl p-8 border border-zinc-700 space-y-10">
            {/* Playback Settings */}
            <div className="bg-zinc-900/30 p-6 rounded-xl border border-zinc-800/50">
              <PlaybackSettings />
            </div>

            {/* Theme Settings */}
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Theme Color</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Customize the primary accent color of the application.
              </p>
              <div className="flex items-center space-x-4 bg-zinc-900/50 p-6 rounded-xl">
                <input
                  type="color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="w-14 h-14 rounded cursor-pointer bg-transparent border-0 p-0"
                  title="Choose your theme color"
                />
                <div>
                  <span className="text-sm text-zinc-400 block mb-1">Hex Code</span>
                  <span className="text-xl text-white font-mono uppercase">{themeColor}</span>
                </div>
              </div>
            </div>

            {/* Cache Settings */}
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Image Cache</h3>
            <p className="text-zinc-400 text-sm mb-6">
              We aggressively cache album covers locally to ensure they load instantly across sessions without hitting the network.
            </p>
            <div className="flex items-center justify-between bg-zinc-900/50 p-6 rounded-xl">
              <div>
                <span className="text-sm text-zinc-400 block mb-1">Space Used</span>
                <span className="text-2xl text-white font-bold">{cacheSize.toFixed(2)} MB</span>
              </div>
              <button
                onClick={handleClearCache}
                className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-medium transition-colors flex items-center justify-center"
              >
                <FiTrash2 className="mr-2" /> Clear Cache
              </button>
            </div>
            </div>
            {/* AI Provider Settings */}
            <div>
              <h3 className="text-xl font-bold text-white mb-2">AI Provider Settings</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Configure the LLM provider for personalized playlist recommendations.
              </p>
              <div className="bg-zinc-900/50 p-6 rounded-xl space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm text-zinc-400">Provider</label>
                  <select 
                    value={llmProvider} 
                    onChange={(e) => setLlmProvider(e.target.value as any)}
                    className="bg-zinc-800 border border-zinc-700 text-white p-3 rounded-lg focus:ring-primary focus:border-primary w-full max-w-xs"
                  >
                    <option value="openrouter">OpenRouter</option>
                    <option value="manual">Manual (Copy & Paste Prompt)</option>
                  </select>
                </div>
                {llmProvider !== 'manual' && (
                  <>
                    <div className="flex flex-col space-y-2 pt-2">
                      <label className="text-sm text-zinc-400">OpenRouter API Key</label>
                      <input 
                        type="password" 
                        value={llmApiKey}
                        onChange={(e) => setLlmApiKey(e.target.value)}
                        placeholder="Enter your OpenRouter API key"
                        className="bg-zinc-800 border border-zinc-700 text-white p-3 rounded-lg focus:ring-primary focus:border-primary w-full"
                      />
                      <p className="text-xs text-zinc-500">Your key is stored locally and never sent to our servers.</p>
                    </div>
                    <div className="flex flex-col space-y-2 pt-2">
                      <label className="text-sm text-zinc-400">Model Name</label>
                      <input 
                        type="text" 
                        value={llmModelName}
                        onChange={(e) => setLlmModelName(e.target.value)}
                        placeholder="e.g. openai/gpt-4o, google/gemini-pro"
                        className="bg-zinc-800 border border-zinc-700 text-white p-3 rounded-lg focus:ring-primary focus:border-primary w-full max-w-md"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Listening History Settings */}
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Listening History</h3>
              <p className="text-zinc-400 text-sm mb-6">
                Your play history is tracked locally to power AI recommendations and stats.
              </p>
              <div className="flex items-center justify-between bg-zinc-900/50 p-6 rounded-xl">
                <div>
                  <span className="text-sm text-zinc-400 block mb-1">Space Used</span>
                  <span className="text-2xl text-white font-bold">{historySize.toFixed(2)} KB</span>
                </div>
                <button
                  onClick={() => {
                    if(confirm('Are you sure you want to clear your listening history? This cannot be undone.')) {
                      useHistoryStore.getState().clearHistory();
                      setHistorySize(0);
                    }
                  }}
                  className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  <FiTrash2 className="mr-2" /> Clear History
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {view !== 'albumDetail' && (
            <div className="flex items-center justify-between mb-4 w-full">
              {/* Left Side: Search Bar */}
              <div className="relative z-50 w-64 focus-within:w-80 transition-all" ref={searchContainerRef}>
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.length > 0) setShowDropdown(true);
                  }}
                  className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-full pl-10 pr-10 py-2 focus:ring-primary focus:border-primary block w-full transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setShowDropdown(false);
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <FiX />
                  </button>
                )}
                {renderSearchDropdown()}
              </div>

              {/* Right Side: Sort & Play Random */}
              <div className="flex items-center space-x-4">
                {/* Dynamic Sort Dropdown based on current view */}
                {view === 'artists' && (
                  <select
                    value={artistSort}
                    onChange={(e) => setArtistSort(e.target.value as any)}
                    className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
                  >
                    <option value="name-asc">Sort: A-Z</option>
                    <option value="name-desc">Sort: Z-A</option>
                    <option value="albums-desc">Sort: Most Albums</option>
                  </select>
                )}

                {view === 'albums' && (
                  <select
                    value={albumSortType}
                    onChange={(e) => setAlbumSortType(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
                  >
                    <option value="newest">Sort: Newest</option>
                    <option value="alphabeticalByName">Sort: A-Z</option>
                    <option value="alphabeticalByArtist">Sort: Artist</option>
                    <option value="recent">Sort: Recently Played</option>
                    <option value="frequent">Sort: Most Played</option>
                    <option value="random">Sort: Random</option>
                  </select>
                )}

                {view === 'tracks' && (
                  <select
                    value={trackSort}
                    onChange={(e) => setTrackSort(e.target.value as any)}
                    className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg focus:ring-primary focus:border-primary block p-2"
                  >
                    <option value="default">Sort: Default (Random)</option>
                    <option value="title">Sort: Title</option>
                    <option value="artist">Sort: Artist</option>
                    <option value="duration">Sort: Longest First</option>
                  </select>
                )}

                <button onClick={handlePlayRandom} className="bg-primary hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm">
                  Play Random
                </button>
              </div>
            </div>
          )}

          {view === 'home' && <HomePage />}
          {view === 'artists' && renderArtists()}
          {view === 'albums' && renderAlbums()}
          {view === 'tracks' && renderTracks()}
          {view === 'albumDetail' && renderAlbumDetail()}
          {view === 'artistDetail' && renderArtistDetail()}
          {view === 'genres' && renderGenres()}
          {view === 'genreDetail' && renderGenreDetail()}
          {view === 'playlists' && renderPlaylists()}
          {view === 'playlistDetail' && renderPlaylistDetail()}
          {view === 'downloader' && <DownloaderView />}
        </>
      )}
      </div>

      {contextMenu?.visible && (
        <div
          className="fixed bg-zinc-800/95 backdrop-blur-xl border border-zinc-700 rounded-xl shadow-2xl z-[9999] py-2 min-w-[200px]"
          style={{ 
            top: Math.min(contextMenu.y, window.innerHeight - 300), 
            left: Math.min(contextMenu.x, window.innerWidth - 220) 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors"
            onClick={(e) => {
              handleAddTracksToQueue(e as any, contextMenu.tracks);
              setContextMenu(null);
            }}
          >
            <FiPlus className="mr-3" /> Add to Queue
          </button>
          
          <div className="px-4 py-2 mt-1 text-xs font-bold text-zinc-500 uppercase tracking-wider border-t border-zinc-700/50 pt-3">
            Add to Playlist
          </div>
          <div className="px-3 pb-2">
            <input
              type="text"
              placeholder="Search playlists..."
              value={playlistSearchQuery}
              onChange={(e) => setPlaylistSearchQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="w-full bg-zinc-900/50 border border-zinc-700/50 text-white text-xs rounded-md px-3 py-1.5 focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {playlistsData?.playlists?.playlist ? (
              (() => {
                const allPlaylists = Array.isArray(playlistsData.playlists.playlist) ? playlistsData.playlists.playlist : [playlistsData.playlists.playlist];
                const filtered = allPlaylists.filter((pl: any) => pl.name.toLowerCase().includes(playlistSearchQuery.toLowerCase()));
                
                if (filtered.length === 0) {
                  return <div className="px-4 py-2 text-sm text-zinc-500">No matching playlists</div>;
                }

                return filtered.slice(0, 3).map((pl: any) => (
                  <button
                    key={pl.id}
                    className="w-full flex items-center px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50 hover:text-white transition-colors truncate"
                    onClick={() => {
                      handleAddTracksToPlaylist(pl.id, contextMenu.tracks.map(t => t.id));
                      setContextMenu(null);
                    }}
                  >
                    <FiList className="mr-3 text-zinc-500 flex-shrink-0" />
                    <span className="truncate">{pl.name}</span>
                  </button>
                ));
              })()
            ) : (
              <div className="px-4 py-2 text-sm text-zinc-500">No playlists found</div>
            )}
          </div>
        </div>
      )}

      <AiPlaylistModal 
        isOpen={isAiPlaylistModalOpen} 
        onClose={() => setIsAiPlaylistModalOpen(false)} 
        ctrl={ctrl} 
      />
    </div>
  );
};
