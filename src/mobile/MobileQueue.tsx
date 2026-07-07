import { usePlayerStore } from '../store/player.store';
import { FiX, FiTrash2, FiPlay } from 'react-icons/fi';
import { CachedImage } from '../components/CachedImage';

interface MobileQueueProps {
  onClose: () => void;
}

export const MobileQueue = ({ onClose }: MobileQueueProps) => {
  const { queue, currentIndex, playFromQueue, removeFromQueue, clearQueue } = usePlayerStore();

  return (
    <div className="fixed inset-0 z-[250] bg-zinc-950 flex flex-col animate-slide-up">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/50 pt-safe flex-shrink-0">
        <h2 className="text-lg font-bold text-white">Play Queue</h2>
        <div className="flex items-center space-x-2">
          {queue.length > 0 && (
            <button 
              onClick={clearQueue}
              className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 rounded hover:bg-red-500/20 mr-2"
            >
              Clear
            </button>
          )}
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white touch-target">
            <FiX className="text-2xl" />
          </button>
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto pb-safe">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <p>Queue is empty</p>
          </div>
        ) : (
          <div className="flex flex-col pb-8">
            {queue.map((track, index) => {
              const isPlaying = index === currentIndex;
              return (
                <div 
                  key={`${track.id}-${index}`} 
                  className={`flex items-center space-x-3 px-4 py-3 active:bg-zinc-800 group ${isPlaying ? 'bg-primary/10' : ''}`}
                  onClick={() => playFromQueue(index)}
                >
                  <div className="w-12 h-12 bg-zinc-800 rounded overflow-hidden flex-shrink-0 relative">
                    <CachedImage id={track.album} url={track.coverArtUrl || ''} alt="Cover" className="w-full h-full object-cover" />
                    {isPlaying && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-4 h-4 text-primary animate-pulse">
                          <FiPlay className="w-full h-full" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className={`text-sm truncate font-medium ${isPlaying ? 'text-primary' : 'text-white'}`}>
                      {track.title}
                    </div>
                    <div className="text-zinc-400 text-xs truncate">
                      {track.artist}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(index);
                    }}
                    className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-red-400 touch-target flex-shrink-0"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
