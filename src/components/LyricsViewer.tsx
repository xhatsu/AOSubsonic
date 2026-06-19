import { useEffect, useState, useCallback } from 'react';
import '@uimaxbai/am-lyrics/am-lyrics.js';
import { AmLyrics } from '@uimaxbai/am-lyrics/react';
import { usePlayerStore } from '../store/player.store';
import { useUIStore } from '../store/ui.store';
import { FiRefreshCw } from 'react-icons/fi';

export const LyricsViewer = () => {
  const currentSong = usePlayerStore((state) => state.queue[state.currentIndex]);
  const themeColor = useUIStore((state) => state.themeColor);
  const [currentTime, setCurrentTime] = useState(0);
  const [forceReset, setForceReset] = useState(false);

  useEffect(() => {
    let animationFrameId: number;

    const updateLyricsTime = () => {
      const audio = document.getElementById('main-audio-player') as HTMLAudioElement | null;
      if (audio) {
        setCurrentTime(audio.currentTime * 1000);
      }
      animationFrameId = requestAnimationFrame(updateLyricsTime);
    };

    animationFrameId = requestAnimationFrame(updateLyricsTime);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleLineClick = useCallback((e: any) => {
    const customEvent = e as CustomEvent<{ timestamp: number }>;
    const audio = document.getElementById('main-audio-player') as HTMLAudioElement | null;
    
    if (audio && customEvent.detail?.timestamp !== undefined) {
      audio.currentTime = customEvent.detail.timestamp / 1000;
      audio.play().catch(console.error);
    }
  }, []);

  const handleRefresh = () => {
    setForceReset(true);
    setTimeout(() => setForceReset(false), 50);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative group">
      {currentSong && (
        <button 
          onClick={handleRefresh}
          className="absolute top-6 right-6 z-50 bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
          title="Reload Lyrics"
        >
          <FiRefreshCw className="text-lg" />
        </button>
      )}

      <AmLyrics 
        duration={forceReset ? -1 : undefined}
        songTitle={currentSong?.title || ''} 
        songArtist={currentSong?.artist || ''}
        songAlbum={currentSong?.album || ''}
        songDurationMs={currentSong?.duration ? currentSong.duration * 1000 : undefined}
        query={currentSong ? `${currentSong.title} ${currentSong.artist}` : ''}
        currentTime={currentTime}
        onLineClick={handleLineClick}
        autoScroll={true} 
        highlightColor={themeColor} 
        style={{ 
          width: '100%', 
          height: '100%', 
          '--am-lyrics-highlight-color': themeColor,
          opacity: currentSong ? 1 : 0,
          pointerEvents: currentSong ? 'auto' : 'none'
        } as any}
      />

      {!currentSong && (
        <div className="absolute inset-0 flex items-center justify-center z-10 text-zinc-500">
          No track playing
        </div>
      )}
    </div>
  );
};
