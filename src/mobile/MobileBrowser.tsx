import { useState, useEffect, useRef } from 'react';
import { useGetAlbumList, useGetArtists, useGetRandomSongsQuery, useGetPlaylists, useGetPlaylist, useSearchQuery, useGetAlbum } from '../api/hooks';
import { useAuthStore } from '../store/auth.store';
import { SubsonicController } from '../api/subsonic';
import { useUIStore } from '../store/ui.store';
import { usePlayerStore } from '../store/player.store';
import { CachedImage } from '../components/CachedImage';
import { FiMusic, FiUser, FiPlay, FiList, FiArrowLeft, FiSearch, FiX } from 'react-icons/fi';

export const MobileBrowser = () => {
  const { view, setView, selectedPlaylistId, setSelectedPlaylistId, selectedAlbumId, setSelectedAlbumId, setSelectedAlbumCover } = useUIStore();
  const playFromQueue = usePlayerStore(state => state.playFromQueue);
  const setQueue = usePlayerStore(state => state.setQueue);
  const play = usePlayerStore(state => state.play);
  const config = useAuthStore(state => state.config);
  const ctrl = config ? new SubsonicController(config) : null;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Data hooks
  const { data: albumsData } = useGetAlbumList('random', 40, 0);
  const { data: artistsData } = useGetArtists();
  const { data: tracksData } = useGetRandomSongsQuery(40, 0);
  const { data: playlistsData } = useGetPlaylists();
  const { data: playlistDetailData, isLoading: isLoadingDetail } = useGetPlaylist(selectedPlaylistId || null);
  const { data: albumDetailData, isLoading: isLoadingAlbumDetail } = useGetAlbum(selectedAlbumId);
  const { data: searchData } = useSearchQuery(debouncedQuery, 5, 5, 20);

  const handlePlayTrack = (track: any, allTracks: any[]) => {
    if (!ctrl) return;
    const mappedQueue = allTracks.map((song: any) => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      streamUrl: ctrl.getStreamUrl(song.id),
      coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
    }));
    const index = mappedQueue.findIndex(t => t.id === track.id);
    if (index !== -1) {
      setQueue(mappedQueue, index);
      playFromQueue(index);
    }
  };

  const handlePlayPlaylist = (songs: any[], startIndex: number = 0) => {
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

  const handleOpenPlaylist = (id: string) => {
    setSelectedPlaylistId(id);
    setView('playlistDetail');
  };

  const handleOpenAlbum = (id: string, coverArt: string) => {
    setSelectedAlbumId(id);
    setSelectedAlbumCover(coverArt);
    setView('albumDetail');
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Track row (reusable) ──
  const TrackRow = ({ track, allTracks }: { track: any; allTracks: any[] }) => (
    <div
      className="flex items-center space-x-3 px-4 py-3 active:bg-zinc-800 touch-target"
      onClick={() => handlePlayTrack(track, allTracks)}
    >
      <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0 relative">
        {track.coverArt && ctrl ? (
          <CachedImage id={track.coverArt} url={ctrl.getCoverArtUrl(track.coverArt)} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600"><FiMusic /></div>
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <FiPlay className="text-white text-xs" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="text-white text-sm truncate font-medium">{track.title}</div>
        <div className="text-zinc-400 text-xs truncate">{track.artist}</div>
      </div>
      <div className="text-zinc-500 text-xs flex-shrink-0">{formatDuration(track.duration || 0)}</div>
    </div>
  );

  // ── Albums ──
  const renderAlbums = () => {
    const albums = albumsData?.albumList?.album;
    const albumArray = albums ? (Array.isArray(albums) ? albums : [albums]) : [];
    return (
      <div className="grid grid-cols-2 gap-4 p-4">
        {albumArray.map((album: any) => (
          <div key={album.id} className="flex flex-col space-y-2 touch-target" onClick={() => handleOpenAlbum(album.id, album.coverArt)}>
            <div className="aspect-square bg-zinc-800 rounded-lg overflow-hidden shadow-md">
              {album.coverArt && ctrl ? (
                <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600"><FiMusic size={32} /></div>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-white truncate">{album.name}</div>
              <div className="text-xs text-zinc-400 truncate">{album.artist}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Artists ──
  const renderArtists = () => {
    const indices = artistsData?.artists?.index || [];
    const allArtists = indices.flatMap((i: any) => i.artist || []);
    return (
      <div className="flex flex-col p-4 space-y-4">
        {allArtists.map((artist: any) => (
          <div key={artist.id} className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <FiUser className="text-zinc-500" />
            </div>
            <div className="text-white font-medium">{artist.name}</div>
          </div>
        ))}
      </div>
    );
  };

  // ── Tracks ──
  const renderTracks = () => {
    const tracks = tracksData?.randomSongs?.song;
    const trackArray = tracks ? (Array.isArray(tracks) ? tracks : [tracks]) : [];
    return (
      <div className="flex flex-col pb-4">
        {trackArray.map((track: any) => (
          <TrackRow key={track.id} track={track} allTracks={trackArray} />
        ))}
      </div>
    );
  };

  // ── Playlists list ──
  const renderPlaylists = () => {
    const playlists = playlistsData?.playlists?.playlist || [];
    const allPlaylists = Array.isArray(playlists) ? playlists : (playlists ? [playlists] : []);

    return (
      <div className="flex flex-col pb-4">
        {allPlaylists.length === 0 && (
          <div className="text-zinc-500 text-center py-12">No playlists yet</div>
        )}
        {allPlaylists.map((pl: any) => (
          <div
            key={pl.id}
            className="flex items-center space-x-4 px-4 py-3 active:bg-zinc-800 touch-target"
            onClick={() => handleOpenPlaylist(pl.id)}
          >
            <div className="w-14 h-14 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center shadow">
              {pl.coverArt && ctrl ? (
                <CachedImage id={pl.coverArt} url={ctrl.getCoverArtUrl(pl.coverArt)} alt={pl.name} className="w-full h-full object-cover" />
              ) : (
                <FiList className="text-2xl text-zinc-500" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-white font-medium truncate">{pl.name}</div>
              <div className="text-zinc-400 text-xs">{pl.songCount} tracks</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ── Playlist detail ──
  const renderPlaylistDetail = () => {
    if (isLoadingDetail) return <div className="text-zinc-400 text-center py-12">Loading playlist…</div>;
    const playlist = playlistDetailData?.playlist;
    if (!playlist) return <div className="text-zinc-400 text-center py-12">Playlist not found</div>;
    const songs = playlist.entry || [];
    const songArray = Array.isArray(songs) ? songs : (songs ? [songs] : []);
    const totalDuration = songArray.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
    const hours = Math.floor(totalDuration / 3600);
    const mins = Math.floor((totalDuration % 3600) / 60);

    return (
      <div className="flex flex-col pb-4">
        {/* Header */}
        <div className="p-4 pb-6">
          <button
            onClick={() => setView('playlists')}
            className="flex items-center text-zinc-400 mb-4 touch-target"
          >
            <FiArrowLeft className="mr-2" /> Back
          </button>

          <div className="flex items-center space-x-4">
            <div className="w-24 h-24 bg-zinc-800 rounded-lg shadow-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
              {playlist.coverArt && ctrl ? (
                <CachedImage id={playlist.coverArt} url={ctrl.getCoverArtUrl(playlist.coverArt)} alt={playlist.name} className="w-full h-full object-cover" />
              ) : (
                <FiList className="text-4xl text-zinc-500" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <h2 className="text-xl font-bold text-white truncate">{playlist.name}</h2>
              <p className="text-zinc-400 text-sm mt-1">
                {songArray.length} tracks • {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
              </p>
              <button
                onClick={() => handlePlayPlaylist(songArray, 0)}
                className="mt-3 bg-primary text-white px-5 py-2 rounded-full text-sm font-semibold flex items-center w-fit active:scale-95 transition-transform"
                disabled={songArray.length === 0}
              >
                <FiPlay className="mr-2" /> Play All
              </button>
            </div>
          </div>
        </div>

        {/* Track list */}
        {songArray.length === 0 && (
          <div className="text-zinc-500 text-center py-8">This playlist is empty</div>
        )}
        {songArray.map((track: any, i: number) => (
          <TrackRow key={`${track.id}-${i}`} track={track} allTracks={songArray} />
        ))}
      </div>
    );
  };

  // ── Album detail ──
  const renderAlbumDetail = () => {
    if (isLoadingAlbumDetail) return <div className="text-zinc-400 text-center py-12">Loading album…</div>;
    const album = albumDetailData?.album;
    if (!album) return <div className="text-zinc-400 text-center py-12">Album not found</div>;
    const songs = album.song || [];
    const songArray = Array.isArray(songs) ? songs : (songs ? [songs] : []);
    const totalDuration = songArray.reduce((sum: number, s: any) => sum + (s.duration || 0), 0);
    const hours = Math.floor(totalDuration / 3600);
    const mins = Math.floor((totalDuration % 3600) / 60);

    return (
      <div className="flex flex-col pb-4">
        {/* Header */}
        <div className="p-4 pb-6">
          <button
            onClick={() => setView('albums')}
            className="flex items-center text-zinc-400 mb-4 touch-target"
          >
            <FiArrowLeft className="mr-2" /> Back
          </button>

          <div className="flex items-center space-x-4">
            <div className="w-24 h-24 bg-zinc-800 rounded-lg shadow-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
              {album.coverArt && ctrl ? (
                <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.name || album.title} className="w-full h-full object-cover" />
              ) : (
                <FiMusic className="text-4xl text-zinc-500" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <h2 className="text-xl font-bold text-white truncate">{album.name || album.title}</h2>
              <p className="text-zinc-400 text-sm mt-1 truncate">{album.artist}</p>
              <p className="text-zinc-500 text-xs mt-1">
                {songArray.length} tracks • {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
              </p>
              <button
                onClick={() => handlePlayPlaylist(songArray, 0)}
                className="mt-3 bg-primary text-white px-5 py-2 rounded-full text-sm font-semibold flex items-center w-fit active:scale-95 transition-transform"
                disabled={songArray.length === 0}
              >
                <FiPlay className="mr-2" /> Play All
              </button>
            </div>
          </div>
        </div>

        {/* Track list */}
        {songArray.length === 0 && (
          <div className="text-zinc-500 text-center py-8">No tracks in this album</div>
        )}
        {songArray.map((track: any, i: number) => (
          <TrackRow key={`${track.id}-${i}`} track={track} allTracks={songArray} />
        ))}
      </div>
    );
  };

  // ── Search ──
  const renderSearch = () => {
    const results = searchData?.searchResult3;
    const artists = results?.artist ? (Array.isArray(results.artist) ? results.artist : [results.artist]) : [];
    const albums = results?.album ? (Array.isArray(results.album) ? results.album : [results.album]) : [];
    const songs = results?.song ? (Array.isArray(results.song) ? results.song : [results.song]) : [];

    return (
      <div className="flex flex-col pb-4">
        {/* Search Input */}
        <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur-md px-4 py-3 border-b border-zinc-800">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search artists, albums, songs…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg pl-10 pr-10 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 touch-target flex items-center justify-center"
              >
                <FiX />
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!debouncedQuery && (
          <div className="text-zinc-500 text-center py-16 px-8">
            <FiSearch className="text-4xl mx-auto mb-4 text-zinc-700" />
            <p>Search your music library</p>
          </div>
        )}

        {/* Results */}
        {debouncedQuery && (
          <div className="flex flex-col">
            {/* Artists */}
            {artists.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-3">Artists</h3>
                <div className="flex flex-col space-y-3">
                  {artists.map((artist: any) => (
                    <div key={artist.id} className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                        {artist.coverArt && ctrl ? (
                          <CachedImage id={artist.coverArt} url={ctrl.getCoverArtUrl(artist.coverArt)} alt={artist.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                          <FiUser className="text-zinc-500" />
                        )}
                      </div>
                      <div className="text-white font-medium text-sm">{artist.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Albums */}
            {albums.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-3">Albums</h3>
                <div className="flex overflow-x-auto space-x-3 no-scrollbar pb-2">
                  {albums.map((album: any) => (
                    <div key={album.id} className="flex-shrink-0 w-28 touch-target" onClick={() => handleOpenAlbum(album.id, album.coverArt)}>
                      <div className="w-28 h-28 bg-zinc-800 rounded-lg overflow-hidden shadow">
                        {album.coverArt && ctrl ? (
                          <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600"><FiMusic size={24} /></div>
                        )}
                      </div>
                      <div className="text-white text-xs font-medium truncate mt-2">{album.name}</div>
                      <div className="text-zinc-400 text-[10px] truncate">{album.artist}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Songs */}
            {songs.length > 0 && (
              <div className="pt-2">
                <h3 className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-2 px-4">Songs</h3>
                {songs.map((track: any) => (
                  <TrackRow key={track.id} track={track} allTracks={songs} />
                ))}
              </div>
            )}

            {/* No results */}
            {debouncedQuery && artists.length === 0 && albums.length === 0 && songs.length === 0 && (
              <div className="text-zinc-500 text-center py-12">
                No results for "{debouncedQuery}"
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Routing ──
  const renderContent = () => {
    if (view === 'albums' || view === 'settings') return renderAlbums();
    if (view === 'artists') return renderArtists();
    if (view === 'tracks') return renderTracks();
    if (view === 'playlists') return renderPlaylists();
    if (view === 'playlistDetail') return renderPlaylistDetail();
    if (view === 'albumDetail') return renderAlbumDetail();
    if (view === 'search') return renderSearch();

    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8 text-center">
        <p>This view ({view}) is not fully implemented on mobile yet.</p>
        <button
          onClick={() => setView('albums')}
          className="mt-4 px-4 py-2 bg-zinc-800 text-white rounded-lg"
        >
          Go to Albums
        </button>
      </div>
    );
  };

  // Determine if we should show the Library header with sub-tabs
  const isLibraryView = view === 'albums' || view === 'artists' || view === 'tracks' || view === 'settings';

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header/Tabs for Library */}
      {isLibraryView && (
        <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md pt-safe px-4 pb-2 border-b border-zinc-800">
          <h1 className="text-2xl font-bold text-white mb-4 mt-2">
            {view === 'settings' ? 'Settings' : 'Library'}
          </h1>

          {view !== 'settings' && (
            <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
              <button
                onClick={() => setView('albums')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${view === 'albums' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-300'}`}
              >
                Albums
              </button>
              <button
                onClick={() => setView('artists')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${view === 'artists' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-300'}`}
              >
                Artists
              </button>
              <button
                onClick={() => setView('tracks')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${view === 'tracks' ? 'bg-primary text-white' : 'bg-zinc-800 text-zinc-300'}`}
              >
                Tracks
              </button>
            </div>
          )}
        </div>
      )}

      {/* Playlist header */}
      {view === 'playlists' && (
        <div className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur-md pt-safe px-4 pb-2 border-b border-zinc-800">
          <h1 className="text-2xl font-bold text-white mb-2 mt-2">Playlists</h1>
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
};
