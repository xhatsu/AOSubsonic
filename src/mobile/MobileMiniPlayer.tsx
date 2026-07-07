import { usePlayerStore } from '../store/player.store';
import { FiPlay, FiPause } from 'react-icons/fi';
import { CachedImage } from '../components/CachedImage';

interface MobileMiniPlayerProps {
  onClick: () => void;
}

export const MobileMiniPlayer = ({ onClick }: MobileMiniPlayerProps) => {
  const { queue, currentIndex, isPlaying, togglePlay } = usePlayerStore();
  const currentSong = queue[currentIndex];

  if (!currentSong) return null;

  return (
    <div 
      className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 relative z-50 touch-target w-full"
      onClick={onClick}
    >
      {/* Progress Bar (Thin line at top) */}
      <div className="absolute top-0 left-0 h-[2px] bg-zinc-800 w-full">
        <div 
          className="h-full bg-primary" 
          style={{ width: '0%' /* Will implement real progress later if needed, but CSS animation or rAF is better to avoid renders */ }} 
        />
      </div>

      <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex-shrink-0 shadow">
        {currentSong.coverArtUrl ? (
          <CachedImage id={currentSong.album} url={currentSong.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 bg-zinc-800 text-xs">
            No Art
          </div>
        )}
      </div>

      <div className="ml-3 flex-1 overflow-hidden">
        <div className="text-white font-medium text-sm truncate">{currentSong.title}</div>
        <div className="text-zinc-400 text-xs truncate">{currentSong.artist}</div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        className="w-12 h-12 flex items-center justify-center text-white touch-target flex-shrink-0"
      >
        {isPlaying ? <FiPause className="text-2xl" /> : <FiPlay className="text-2xl ml-1" />}
      </button>
    </div>
  );
};
