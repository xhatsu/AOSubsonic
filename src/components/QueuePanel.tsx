import { useEffect, useRef, useState } from 'react';
import { usePlayerStore } from '../store/player.store';
import { FiX, FiTrash2, FiPlay, FiMusic, FiMenu, FiShuffle } from 'react-icons/fi';
import { CachedImage } from './CachedImage';

export const QueuePanel = () => {
  const { queue, currentIndex, isPlaying, playFromQueue, removeFromQueue, clearQueue, toggleQueue, moveInQueue, shuffleQueue } = usePlayerStore();
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Scroll to active song when queue panel is opened or active song changes
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentIndex]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      moveInQueue(draggedIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatQueueDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalQueueDuration = queue.reduce((acc, song) => acc + (song.duration || 0), 0);

  return (
    <div className="flex flex-col h-full bg-zinc-950/95 text-zinc-100 font-sans">
      {/* Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Play Queue</h2>
          <p className="text-zinc-400 text-xs mt-1">
            {queue.length} track{queue.length !== 1 ? 's' : ''} • {formatQueueDuration(totalQueueDuration)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          {queue.length > 0 && (
            <>
              <button
                onClick={shuffleQueue}
                className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                title="Shuffle Queue"
              >
                <FiShuffle className="text-lg" />
              </button>
              <button
                onClick={clearQueue}
                className="p-2 text-zinc-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-all"
                title="Clear Queue"
              >
                <FiTrash2 className="text-lg" />
              </button>
            </>
          )}
          <button
            onClick={toggleQueue}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all"
            title="Close Panel"
          >
            <FiX className="text-lg" />
          </button>
        </div>
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-3">
            <FiMusic className="text-4xl" />
            <span className="text-sm font-medium">Queue is empty</span>
          </div>
        ) : (
          queue.map((song, index) => {
            const isActive = index === currentIndex;
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;
            let dragBorderClass = '';
            
            if (isDragOver && draggedIndex !== null && draggedIndex !== index) {
               dragBorderClass = draggedIndex < index ? 'border-b-primary border-b-2' : 'border-t-primary border-t-2';
            }

            return (
              <div
                key={`${song.id}-${index}`}
                ref={isActive ? activeItemRef : null}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => handleDrop(e, index)}
                className={`group flex items-center p-2 rounded-xl transition-all cursor-grab active:cursor-grabbing ${
                  isActive
                    ? 'bg-primary/10 border-primary/20 shadow-[0_0_15px_rgba(170,59,255,0.05)]'
                    : 'hover:bg-zinc-900'
                } ${isDragging ? 'opacity-50' : 'opacity-100'} ${dragBorderClass || 'border border-transparent'}`}
              >
                {/* Drag Handle Icon (visible on hover) */}
                <div className="w-6 flex-shrink-0 flex items-center justify-center text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  <FiMenu />
                </div>

                {/* Play index / active indicator */}
                <div
                  onClick={() => playFromQueue(index)}
                  className="w-8 flex-shrink-0 flex items-center justify-center text-sm font-medium cursor-pointer"
                >
                  {isActive && isPlaying ? (
                    <span className="flex space-x-0.5 items-end h-3">
                      <span className="w-0.75 bg-primary animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '0.8s' }} />
                      <span className="w-0.75 h-3 bg-primary animate-bounce" style={{ animationDelay: '0.3s', animationDuration: '0.8s' }} />
                      <span className="w-0.75 h-2 bg-primary animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '0.8s' }} />
                    </span>
                  ) : (
                    <span className={`group-hover:hidden ${isActive ? 'text-primary' : 'text-zinc-500'}`}>
                      {index + 1}
                    </span>
                  )}
                  <FiPlay className={`hidden group-hover:block ${isActive ? 'text-primary' : 'text-white'}`} />
                </div>

                {/* Album Cover */}
                <div
                  onClick={() => playFromQueue(index)}
                  className="w-10 h-10 rounded bg-zinc-800 flex-shrink-0 overflow-hidden relative mr-3 cursor-pointer"
                >
                  {song.coverArtUrl ? (
                    <CachedImage id={song.album} url={song.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <FiMusic />
                    </div>
                  )}
                </div>

                {/* Title & Artist */}
                <div
                  onClick={() => playFromQueue(index)}
                  className="flex-1 min-w-0 mr-3 cursor-pointer"
                >
                  <div className={`text-sm font-medium truncate ${isActive ? 'text-primary' : 'text-white'}`}>
                    {song.title}
                  </div>
                  <div className="text-xs text-zinc-400 truncate mt-0.5">
                    {song.artist}
                  </div>
                </div>

                {/* Duration / Delete Action */}
                <div className="flex-shrink-0 flex items-center space-x-2 text-xs text-zinc-500">
                  <span className="group-hover:hidden font-mono">
                    {formatDuration(song.duration || 0)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromQueue(index);
                    }}
                    className="hidden group-hover:flex p-1.5 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors"
                    title="Remove from queue"
                  >
                    <FiX className="text-sm" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
