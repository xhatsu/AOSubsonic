import { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth.store';
import { useUIStore } from './store/ui.store';
import { usePlayerStore } from './store/player.store';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { PlayerBar } from './components/PlayerBar';
import { AudioPlayer } from './components/AudioPlayer';
import { LyricsViewer } from './components/LyricsViewer';
import { QueuePanel } from './components/QueuePanel';
import { MobileApp } from './mobile/MobileApp';
import { DynamicBackground } from './components/DynamicBackground';

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

function App() {
  const config = useAuthStore((state) => state.config);
  const showLyrics = useUIStore((state) => state.showLyrics);
  const themeColor = useUIStore((state) => state.themeColor);
  const lyricsStyle = useUIStore((state) => state.lyricsStyle);
  const showQueue = usePlayerStore((state) => state.showQueue);
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const currentSong = queue[currentIndex];
  
  const isMobile = useIsMobile();

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', themeColor);
  }, [themeColor]);

  if (!config) {
    return <Login />;
  }

  return (
    <>
      <AudioPlayer />
      {isMobile ? (
        <MobileApp />
      ) : (
        <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans relative">
          {/* Main Layout */}
          <div className="flex flex-1 overflow-hidden relative">
            <Sidebar />
            <MainContent />
            
            {/* Integrated Lyrics Panel */}
            <div 
              className="flex-shrink-0 bg-zinc-950 border-white/10 relative overflow-hidden transition-[width,border-width] duration-300 ease-in-out"
              style={{ width: showLyrics ? '450px' : '0px', borderLeftWidth: showLyrics ? '1px' : '0px' }}
            >
              {/* Inner wrapper ensures content doesn't squish during animation */}
              <div className="w-[450px] h-full absolute top-0 right-0">
                {lyricsStyle === 'dynamic' ? (
                  <DynamicBackground imageUrl={currentSong?.coverArtUrl} isVisible={showLyrics} />
                ) : (
                  <div className="absolute inset-0 z-0 bg-black pointer-events-none" />
                )}
                <div className="relative z-10 w-full h-full">
                  <LyricsViewer />
                </div>
              </div>
            </div>
          </div>

          {/* Floating Queue Panel */}
          <div
            className={`fixed top-3 right-3 w-[400px] bottom-[calc(6rem+0.75rem)] rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl z-[110] transition-transform duration-300 ease-in-out ${showQueue ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'}`}
          >
            <QueuePanel />
          </div>

          {/* Bottom Bar */}
          <PlayerBar />
        </div>
      )}
    </>
  );
}

export default App;
