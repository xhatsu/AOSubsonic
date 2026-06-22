import { useEffect } from 'react';
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

function App() {
  const config = useAuthStore((state) => state.config);
  const showLyrics = useUIStore((state) => state.showLyrics);
  const showQueue = usePlayerStore((state) => state.showQueue);
  const themeColor = useUIStore((state) => state.themeColor);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', themeColor);
  }, [themeColor]);

  if (!config) {
    return <Login />;
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans relative">
      {/* Invisible global audio element */}
      <AudioPlayer />
      
      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <MainContent />
        
      </div>

      {/* Floating Lyrics Panel */}
      <div 
        className={`fixed top-0 right-0 w-[450px] h-full border-l border-white/5 bg-zinc-950 shadow-2xl z-[100] transition-transform duration-300 ease-in-out ${showLyrics ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <LyricsViewer />
      </div>

      {/* Floating Queue Panel */}
      <div 
        className={`fixed top-0 right-0 w-[400px] h-full border-l border-white/5 bg-zinc-950 shadow-2xl z-[110] transition-transform duration-300 ease-in-out ${showQueue ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <QueuePanel />
      </div>

      {/* Bottom Bar */}
      <PlayerBar />
    </div>
  );
}

export default App;
