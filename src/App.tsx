import { useEffect } from 'react';
import { useAuthStore } from './store/auth.store';
import { useUIStore } from './store/ui.store';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { PlayerBar } from './components/PlayerBar';
import { AudioPlayer } from './components/AudioPlayer';

import { LyricsViewer } from './components/LyricsViewer';

function App() {
  const config = useAuthStore((state) => state.config);
  const showLyrics = useUIStore((state) => state.showLyrics);
  const themeColor = useUIStore((state) => state.themeColor);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', themeColor);
  }, [themeColor]);

  if (!config) {
    return <Login />;
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      {/* Invisible global audio element */}
      <AudioPlayer />
      
      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar />
        <MainContent />
        
        {/* Floating Lyrics Panel */}
        <div 
          className={`absolute top-0 right-0 w-[450px] h-full border-l border-white/5 bg-zinc-950/80 backdrop-blur-3xl shadow-2xl z-[60] transition-transform duration-300 ease-in-out ${showLyrics ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <LyricsViewer />
        </div>
      </div>

      {/* Bottom Bar */}
      <PlayerBar />
    </div>
  );
}

export default App;
