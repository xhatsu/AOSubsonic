import { useState, useMemo, useEffect, useRef } from 'react';
import { useGetArtists, useGetAlbumList, useGetRandomSongsQuery, useGetAlbum, useSearchQuery, useGetArtistInfo2, useGetArtist } from '../api/hooks';
import { useAuthStore } from '../store/auth.store';
import { SubsonicController } from '../api/subsonic';
import { usePlayerStore } from '../store/player.store';
import { useUIStore } from '../store/ui.store';
import { FiPlay, FiArrowLeft, FiSearch, FiX, FiMusic, FiSettings, FiTrash2 } from 'react-icons/fi';
import { CachedImage } from './CachedImage';
import { WikiImageFallback } from './WikiImageFallback';
import { getCacheSizeInMB, clearImageCache } from '../utils/imageCache';

export const MainContent = () => {
  const { view, setView } = useUIStore();
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>('');
  const [selectedArtistId, setSelectedArtistId] = useState<string>('');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [cacheSize, setCacheSize] = useState<number>(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const refreshCacheSize = async () => {
    const size = await getCacheSizeInMB();
    setCacheSize(size);
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
  const [albumSortType, setAlbumSortType] = useState<string>('newest');
  const [trackSort, setTrackSort] = useState<'default' | 'title' | 'artist' | 'duration'>('default');
  
  const { data: artistsData, isLoading: isLoadingArtists } = useGetArtists();
  const { data: albumsData, isLoading: isLoadingAlbums } = useGetAlbumList(albumSortType, 50);
  const { data: tracksData, isLoading: isLoadingTracks } = useGetRandomSongsQuery(50);
  const { data: albumDetailData, isLoading: isLoadingAlbumDetail } = useGetAlbum(selectedAlbumId);
  const { data: artistDetailData, isLoading: isLoadingArtistDetail } = useGetArtist(selectedArtistId);
  const { data: artistInfoData, isLoading: isLoadingArtistInfo } = useGetArtistInfo2(selectedArtistId);
  const { data: searchData, isLoading: isLoadingSearch } = useSearchQuery(debouncedSearchQuery);

  const config = useAuthStore(state => state.config);
  const setQueue = usePlayerStore(state => state.setQueue);
  const play = usePlayerStore(state => state.play);

  const getController = () => config ? new SubsonicController(config) : null;
  const ctrl = getController();

  const handlePlayRandom = async () => {
    if (!config) return;
    try {
      const controller = new SubsonicController(config);
      const data = await controller.getRandomSongs(20);
      const randomSongsData = data.randomSongs?.song || [];
      
      if (randomSongsData.length > 0) {
        const mappedQueue = randomSongsData.map((song: any) => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          streamUrl: controller.getStreamUrl(song.id),
          coverArtUrl: song.coverArt ? controller.getCoverArtUrl(song.coverArt) : undefined
        }));
        
        setQueue(mappedQueue, 0);
        play();
      } else {
        alert("No random songs returned from server");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to play random songs.");
    }
  };

  const handleOpenArtist = (artistId: string) => {
    setSelectedArtistId(artistId);
    setView('artistDetail');
  };

  const handleOpenAlbum = (albumId: string) => {
    setSelectedAlbumId(albumId);
    setView('albumDetail');
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

  const renderArtists = () => {
    if (isLoadingArtists) return <div className="text-zinc-400 mt-4">Loading artists...</div>;
    if (sortedArtists.length === 0) return <div className="text-zinc-400 mt-4">No artists found.</div>;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
        {sortedArtists.map((artist: any) => (
          <div key={artist.id} className="group cursor-pointer p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors" onClick={() => handleOpenArtist(artist.id)}>
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
    );
  };

  const renderAlbums = () => {
    if (isLoadingAlbums) return <div className="text-zinc-400 mt-4">Loading albums...</div>;
    const allAlbums = albumsData?.albumList?.album || [];
    if (allAlbums.length === 0) return <div className="text-zinc-400 mt-4">No albums found.</div>;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mt-6">
        {allAlbums.map((album: any) => (
          <div key={album.id} className="group cursor-pointer p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors" onClick={() => handleOpenAlbum(album.id)}>
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
    );
  };

  const renderTracks = () => {
    if (isLoadingTracks) return <div className="text-zinc-400 mt-4">Loading tracks...</div>;
    if (sortedTracks.length === 0) return <div className="text-zinc-400 mt-4">No tracks found.</div>;
    return (
      <div className="flex flex-col space-y-2 pb-10 mt-6">
        {sortedTracks.map((track: any, index: number) => (
          <div key={track.id} onClick={() => handlePlayAlbumList(sortedTracks, index)} className="group flex items-center p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
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
            <div className="text-zinc-500 text-sm w-16 text-right">
              {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSearchDropdown = () => {
    if (!showDropdown || debouncedSearchQuery.length === 0) return null;

    return (
      <div className="absolute top-full right-0 mt-2 w-[32rem] max-h-[70vh] overflow-y-auto bg-zinc-800/95 backdrop-blur-xl border border-zinc-700/50 rounded-2xl shadow-2xl z-50 p-4">
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
                            handleOpenArtist(artist.id);
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
                            handleOpenAlbum(album.id);
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

                {searchSongs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3 px-2">Tracks</h3>
                    <div className="flex flex-col space-y-1">
                      {searchSongs.slice(0, 10).map((track: any, index: number) => (
                        <div 
                          key={track.id} 
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
                          <div className="text-xs text-zinc-500 ml-2 flex-shrink-0">
                            {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
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

  const renderAlbumDetail = () => {
    if (isLoadingAlbumDetail) return <div className="text-zinc-400 mt-4">Loading album details...</div>;
    const album = albumDetailData?.album;
    if (!album) return <div className="text-zinc-400 mt-4">Album not found.</div>;
    const songs = album.song || [];

    return (
      <div className="flex flex-col mt-4 pb-10">
        <button onClick={() => setView('albums')} className="flex items-center text-zinc-400 hover:text-white mb-6 w-fit transition-colors">
          <FiArrowLeft className="mr-2" /> Back to Albums
        </button>
        
        <div className="flex items-end space-x-6 mb-8">
          <div className="w-48 h-48 bg-zinc-800 rounded-lg shadow-2xl overflow-hidden flex-shrink-0">
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
            <button onClick={() => handlePlayAlbumList(songs, 0)} className="bg-primary hover:bg-purple-600 text-white px-6 py-3 rounded-full font-bold transition-colors flex items-center">
              <FiPlay className="mr-2" /> Play Album
            </button>
          </div>
        </div>

        <div className="flex flex-col space-y-1">
          {songs.map((track: any, index: number) => (
            <div key={track.id} onClick={() => handlePlayAlbumList(songs, index)} className="group flex items-center p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
              <div className="w-8 text-center text-zinc-500 group-hover:hidden">{index + 1}</div>
              <div className="w-8 text-center text-white hidden group-hover:block"><FiPlay /></div>
              <div className="flex-1 min-w-0 ml-4">
                <h4 className="text-white font-medium truncate">{track.title}</h4>
              </div>
              <div className="text-zinc-500 text-sm text-right">
                {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
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
        <button onClick={() => setView('artists')} className="flex items-center text-zinc-400 hover:text-white mb-6 w-fit transition-colors">
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
              <div key={album.id} className="group cursor-pointer p-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl transition-colors" onClick={() => handleOpenAlbum(album.id)}>
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
                <div key={similar.id} className="flex flex-col items-center cursor-pointer w-32 flex-shrink-0 group" onClick={() => handleOpenArtist(similar.id)}>
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

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-900 p-8 flex flex-col">
      {view === 'settings' ? (
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-white mb-8">Settings</h2>
          <div className="max-w-2xl bg-zinc-800/50 rounded-2xl p-8 border border-zinc-700">
            <h3 className="text-xl font-bold text-white mb-6">Image Cache</h3>
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
        </div>
      ) : (
        <>
          {view !== 'albumDetail' && (
            <div className="flex items-center justify-end mb-4">
              <div className="flex items-center space-x-4">
            
            <div className="relative z-50" ref={searchContainerRef}>
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchQuery.length > 0) setShowDropdown(true);
                }}
                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded-full pl-10 pr-10 py-2 focus:ring-primary focus:border-primary block w-64 transition-all focus:w-80"
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
      
      {view === 'artists' && renderArtists()}
      {view === 'albums' && renderAlbums()}
      {view === 'tracks' && renderTracks()}
      {view === 'albumDetail' && renderAlbumDetail()}
      {view === 'artistDetail' && renderArtistDetail()}
    </>
      )}
    </div>
  );
};
