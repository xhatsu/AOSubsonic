import { useState } from 'react';
import { usePlayerStore } from '../store/player.store';
import { FiChevronDown, FiList, FiPlay, FiPause, FiSkipBack, FiSkipForward, FiShuffle, FiFileText, FiMaximize2, FiMoon, FiDroplet } from 'react-icons/fi';
import { CachedImage } from '../components/CachedImage';
import { TrackProgressBar } from '../components/PlayerBar';
import { LyricsViewer } from '../components/LyricsViewer';
import { useUIStore } from '../store/ui.store';

interface MobileNowPlayingProps {
  onClose: () => void;
  onOpenQueue: () => void;
}

export const MobileNowPlaying = ({ onClose, onOpenQueue }: MobileNowPlayingProps) => {
  const { queue, currentIndex, isPlaying, togglePlay, nextTrack, prevTrack, shuffleQueue } = usePlayerStore();
  const currentSong = queue[currentIndex];
  const { lyricsStyle, setLyricsStyle } = useUIStore();
  
  // false = Cover Art, true = Lyrics
  const [showLyrics, setShowLyrics] = useState(false);

  if (!currentSong) return null;

  return (
    <div className={`fixed inset-0 z-[200] flex flex-col overflow-hidden animate-slide-up transition-colors duration-700 ${showLyrics && lyricsStyle === 'clean' ? 'bg-black' : 'bg-zinc-950'}`}>
      {/* Background Blur Effect */}
      {currentSong.coverArtUrl && !(showLyrics && lyricsStyle === 'clean') && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-zinc-950">
          <img
            src={currentSong.coverArtUrl}
            alt=""
            className="absolute top-1/2 left-1/2 w-64 h-64 object-cover opacity-80"
            style={{ 
              filter: 'blur(20px) saturate(200%)',
              transform: 'translate(-50%, -50%) scale(5)'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/60 via-zinc-950/80 to-zinc-950" />
        </div>
      )}

      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 relative z-10 flex-shrink-0 pt-safe">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-white touch-target">
          <FiChevronDown className="text-3xl" />
        </button>
        <div className="text-xs uppercase tracking-widest text-zinc-400 font-semibold">
          {showLyrics ? 'Lyrics' : 'Now Playing'}
        </div>
        <button onClick={onOpenQueue} className="w-10 h-10 flex items-center justify-center text-white touch-target">
          <FiList className="text-xl" />
        </button>
      </div>

      {/* Main Content Area (Cover or Lyrics) */}
      <div className="flex-1 relative z-10 flex flex-col px-8 pb-8 overflow-hidden min-h-0">
        {showLyrics ? (
          <div className="w-full flex-1 min-h-0 relative -mx-4 px-4">
            <LyricsViewer />
          </div>
        ) : (
          <div 
            className="w-full aspect-square bg-zinc-900 rounded-xl shadow-2xl overflow-hidden mt-auto mb-8 relative flex-shrink-0"
            onClick={() => setShowLyrics(true)}
          >
            {currentSong.coverArtUrl ? (
              <CachedImage id={currentSong.album} url={currentSong.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <FiMaximize2 className="text-4xl" />
              </div>
            )}
          </div>
        )}

        {/* Track Info */}
        <div className="mb-6 mt-6 flex-shrink-0">
          <h2 className="text-2xl font-bold text-white truncate">{currentSong.title}</h2>
          <p className="text-zinc-400 text-lg truncate mt-1">{currentSong.artist}</p>
        </div>

        {/* Progress */}
        <div className="mb-6 flex-shrink-0">
          <TrackProgressBar duration={currentSong.duration || 0} />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          {showLyrics ? (
            <button 
              onClick={() => setLyricsStyle(lyricsStyle === 'clean' ? 'dynamic' : 'clean')}
              className="text-zinc-400 hover:text-white touch-target flex items-center justify-center"
            >
              {lyricsStyle === 'clean' ? <FiDroplet className="text-2xl" /> : <FiMoon className="text-2xl" />}
            </button>
          ) : (
            <button onClick={shuffleQueue} className="text-zinc-400 hover:text-white touch-target flex items-center justify-center">
              <FiShuffle className="text-2xl" />
            </button>
          )}
          
          <div className="flex items-center space-x-6">
            <button onClick={prevTrack} className="text-white touch-target flex items-center justify-center">
              <FiSkipBack className="text-3xl fill-current" />
            </button>
            <button
              onClick={togglePlay}
              className="w-16 h-16 flex items-center justify-center bg-white text-black rounded-full active:scale-95 transition-transform shadow-lg"
            >
              {isPlaying ? <FiPause className="text-3xl" /> : <FiPlay className="text-3xl ml-2" />}
            </button>
            <button onClick={nextTrack} className="text-white touch-target flex items-center justify-center">
              <FiSkipForward className="text-3xl fill-current" />
            </button>
          </div>

          <button 
            onClick={() => setShowLyrics(!showLyrics)} 
            className={`touch-target flex items-center justify-center ${showLyrics ? 'text-primary' : 'text-zinc-400 hover:text-white'}`}
          >
            <FiFileText className="text-2xl" />
          </button>
        </div>
      </div>
    </div>
  );
};
