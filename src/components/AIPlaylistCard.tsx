import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/auth.store';
import { SubsonicController } from '../api/subsonic';
import { CachedImage } from './CachedImage';
import { FiPlay } from 'react-icons/fi';

interface AIPlaylistCardProps {
  title: string;
  description: string;
  songIds: string[];
  onClick: () => void;
}

export const AIPlaylistCard: React.FC<AIPlaylistCardProps> = ({ title, description, songIds, onClick }) => {
  const config = useAuthStore(state => state.config);
  const ctrl = useMemo(() => config ? new SubsonicController(config) : null, [config]);
  const [coverUrls, setCoverUrls] = useState<{id: string, url: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadCovers = async () => {
      if (!ctrl || !songIds || songIds.length === 0) return;
      setIsLoading(true);
      try {
        const fetchedCovers: {id: string, url: string}[] = [];
        const seenAlbums = new Set<string>();
        
        for (const id of songIds) {
          if (fetchedCovers.length >= 4) break;
          try {
            const res = await ctrl.getSong(id);
            const song = res.song;
            const albumKey = song?.albumId || song?.album || song?.coverArt;
            
            if (song && song.coverArt && albumKey && !seenAlbums.has(albumKey)) {
              seenAlbums.add(albumKey);
              fetchedCovers.push({
                id: song.coverArt,
                url: ctrl.getCoverArtUrl(song.coverArt)
              });
            }
          } catch (e) {
            // ignore individual song fetch errors
          }
        }
        
        if (isMounted) {
          setCoverUrls(fetchedCovers);
        }
      } catch (e) {
        console.error("Failed to load playlist covers", e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadCovers();
    return () => { isMounted = false; };
  }, [ctrl, songIds]);

  return (
    <div className="w-64 flex-shrink-0 snap-start group cursor-pointer" onClick={onClick}>
      <div className="bg-zinc-800/40 rounded-xl p-4 hover:bg-zinc-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
        
        {/* 2x2 Grid for Covers */}
        <div className="w-full aspect-square bg-zinc-900 rounded-lg mb-4 relative overflow-hidden flex items-center justify-center">
          {isLoading ? (
             <div className="w-full h-full animate-pulse bg-zinc-800"></div>
          ) : coverUrls.length > 0 ? (
             <div className={`w-full h-full grid ${coverUrls.length >= 2 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1'}`}>
               {coverUrls.slice(0, 4).map((cover, i) => (
                 <div key={i} className="w-full h-full relative border border-zinc-900">
                    <CachedImage id={cover.id} url={cover.url} alt="cover" className="w-full h-full object-cover" />
                 </div>
               ))}
               {/* Fill empty spots if less than 4 but more than 1 */}
               {coverUrls.length < 4 && coverUrls.length > 1 && Array.from({ length: 4 - coverUrls.length }).map((_, i) => (
                 <div key={`empty-${i}`} className="w-full h-full bg-zinc-800 border border-zinc-900"></div>
               ))}
             </div>
          ) : (
             <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600 font-bold">Mix</div>
          )}
          
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg">
              <FiPlay className="text-black fill-black ml-1 text-xl" />
            </div>
          </div>
        </div>
        
        <h3 className="font-bold text-white text-lg truncate">{title}</h3>
        <p className="text-sm text-zinc-400 mt-1 line-clamp-2 leading-snug">{description}</p>
        <div className="mt-3 text-xs text-zinc-500 font-medium">
          {songIds.length} tracks
        </div>
      </div>
    </div>
  );
};
