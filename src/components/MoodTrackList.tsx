import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/auth.store';
import { SubsonicController } from '../api/subsonic';
import { usePlayerStore, type QueueSong } from '../store/player.store';
import { CachedImage } from './CachedImage';
import { FiPlay } from 'react-icons/fi';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';

interface MoodTrackListProps {
  title: string;
  description: string;
  songIds: string[];
  onPlayAll: () => void;
}

export const MoodTrackList: React.FC<MoodTrackListProps> = ({ title, description, songIds, onPlayAll }) => {
  const config = useAuthStore(state => state.config);
  const ctrl = useMemo(() => config ? new SubsonicController(config) : null, [config]);
  const { setQueue, play } = usePlayerStore();
  const [songs, setSongs] = useState<QueueSong[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useHorizontalScroll<HTMLDivElement>();

  useEffect(() => {
    let isMounted = true;
    const loadSongs = async () => {
      if (!ctrl || !songIds || songIds.length === 0) return;
      setIsLoading(true);
      try {
        // Fetch up to 10 songs to keep the UI clean
        const idsToFetch = songIds.slice(0, 10);
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
        }
      } catch (e) {
        console.error("Failed to load mood songs", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadSongs();
    
    return () => { isMounted = false; };
  }, [ctrl, songIds]);

  const playSong = (index: number) => {
    setQueue(songs, index);
    play();
  };


  return (
    <div className="mb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 px-2 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-3xl font-bold text-white capitalize tracking-tight">{title}</h3>
          <p className="text-sm text-zinc-400 mt-2">{description}</p>
        </div>
        <button 
          onClick={onPlayAll} 
          className="mt-4 md:mt-0 flex items-center justify-center bg-white text-black hover:bg-zinc-200 font-bold px-6 py-2.5 rounded-full transition-colors"
        >
          <FiPlay className="mr-2 fill-current" /> Listen Now
        </button>
      </div>

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
          songs.map((song, index) => (
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
    </div>
  );
};
