import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/auth.store';
import { SubsonicController } from '../api/subsonic';
import { usePlayerStore, type QueueSong } from '../store/player.store';
import { CachedImage } from './CachedImage';
import { FiPlay, FiSave } from 'react-icons/fi';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';

const songCache = new Map<string, QueueSong[]>();

interface MoodTrackListProps {
  title: string;
  description: string;
  songIds: string[];
  onPlayAll: () => void;
  layout?: 'row' | 'list';
}

export const MoodTrackList: React.FC<MoodTrackListProps> = ({ title, description, songIds, onPlayAll, layout = 'row' }) => {
  const config = useAuthStore(state => state.config);
  const ctrl = useMemo(() => config ? new SubsonicController(config) : null, [config]);
  const { setQueue, play } = usePlayerStore();
  const [songs, setSongs] = useState<QueueSong[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useHorizontalScroll<HTMLDivElement>();

  const songIdsStr = useMemo(() => songIds.join(','), [songIds]);
  const displayedSongs = isExpanded ? songs : songs.slice(0, 10);

  const saveAsPlaylist = async () => {
    if (!ctrl || songIds.length === 0) return;
    setIsSaving(true);
    try {
      await ctrl.createPlaylist(title, songIds);
      alert(`Playlist '${title}' saved successfully!`);
    } catch (e: any) {
      alert(`Failed to save playlist: ${e.message || e}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadSongs = async () => {
      const currentIds = songIdsStr ? songIdsStr.split(',') : [];
      if (!ctrl || currentIds.length === 0) return;

      if (songCache.has(songIdsStr)) {
        setSongs(songCache.get(songIdsStr)!);
        return;
      }

      setIsLoading(true);
      try {
        // Fetch all provided songs
        const idsToFetch = currentIds;
        const fetchedSongs: QueueSong[] = [];

        for (const id of idsToFetch) {
          try {
            const res = await ctrl.getSong(id);
            const song = res.song;
            if (song) {
              fetchedSongs.push({
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                duration: song.duration,
                streamUrl: ctrl.getStreamUrl(song.id),
                coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
              });
            }
          } catch (e) {
            console.error("Failed to load song", id, e);
          }
        }

        if (isMounted) {
          setSongs(fetchedSongs);
          songCache.set(songIdsStr, fetchedSongs);
        }
      } catch (e) {
        console.error("Failed to load mood songs", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadSongs();

    return () => { isMounted = false; };
  }, [ctrl, songIdsStr]);

  const playSong = (index: number) => {
    setQueue(songs, index);
    play();
  };


  return (
    <div className="mb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 px-2 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-xl font-semibold text-zinc-200 tracking-wide">{title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        </div>
        <div className="flex flex-row gap-2 mt-4 md:mt-0 items-center">
          {songs.length > 10 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm font-bold text-zinc-400 hover:text-white px-4 transition-colors"
            >
              {isExpanded ? "Show Less" : `View All (${songs.length})`}
            </button>
          )}
          <button
            onClick={saveAsPlaylist}
            disabled={isSaving}
            className="flex items-center justify-center bg-zinc-800 text-white hover:bg-zinc-700 font-bold px-6 py-2.5 rounded-full transition-colors disabled:opacity-50"
          >
            <FiSave className="mr-2" /> {isSaving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onPlayAll}
            className="flex items-center justify-center bg-white text-black hover:bg-zinc-200 font-bold px-6 py-2.5 rounded-full transition-colors"
          >
            <FiPlay className="mr-2 fill-current" /> Listen Now
          </button>
        </div>
      </div>

      {layout === 'row' ? (
        <div ref={scrollRef} className="flex space-x-4 overflow-x-auto scrollbar-thin pb-4 snap-x px-2">
          {isLoading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="w-40 flex-shrink-0 snap-start animate-pulse">
                <div className="aspect-square bg-zinc-800 rounded-xl mb-3"></div>
                <div className="h-4 bg-zinc-800 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-zinc-800 rounded w-1/2"></div>
              </div>
            ))
          ) : (
            displayedSongs.map((song, index) => (
              <div
                key={song.id}
                onClick={() => playSong(index)}
                className="w-40 flex-shrink-0 snap-start group cursor-pointer"
              >
                <div className="aspect-square bg-zinc-800 rounded-xl mb-3 relative overflow-hidden shadow-md">
                  {song.coverArtUrl && <CachedImage id={song.id} url={song.coverArtUrl} alt={song.title} className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-all">
                      <FiPlay className="text-black fill-black ml-1" />
                    </div>
                  </div>
                </div>
                <div className="font-bold text-white text-sm truncate">{song.title}</div>
                <div className="text-xs text-zinc-400 truncate mt-1">{song.artist}</div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col space-y-1 px-2">
          {isLoading ? (
            [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center space-x-4 p-2 rounded-lg animate-pulse">
                <div className="w-12 h-12 bg-zinc-800 rounded-md flex-shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-zinc-800 rounded w-1/3"></div>
                  <div className="h-3 bg-zinc-800 rounded w-1/4"></div>
                </div>
              </div>
            ))
          ) : (
            displayedSongs.map((song, index) => (
              <div
                key={song.id}
                onClick={() => playSong(index)}
                className="flex items-center space-x-4 p-2 rounded-lg hover:bg-white/5 group cursor-pointer transition-colors"
              >
                <div className="w-12 h-12 relative flex-shrink-0 rounded-md overflow-hidden bg-zinc-800 shadow-sm">
                  {song.coverArtUrl && <CachedImage id={song.id} url={song.coverArtUrl} alt={song.title} className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <FiPlay className="text-white fill-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium text-sm truncate">{song.title}</div>
                  <div className="text-zinc-400 text-xs truncate">{song.artist}</div>
                </div>
                {song.duration && (
                  <div className="text-zinc-500 text-xs font-medium w-12 text-right">
                    {Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
