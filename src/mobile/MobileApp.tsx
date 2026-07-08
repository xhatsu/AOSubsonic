import { useState } from 'react';

import { MobileTabBar } from './MobileTabBar.tsx';
import { MobileMiniPlayer } from './MobileMiniPlayer.tsx';
import { MobileNowPlaying } from './MobileNowPlaying.tsx';
import { MobileBrowser } from './MobileBrowser.tsx';
import { MobileQueue } from './MobileQueue.tsx';

// App shell for mobile

export const MobileApp = () => {
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  
  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Main Browse Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <MobileBrowser />
      </div>

      <div className="absolute bottom-0 w-full z-50">
        {/* Mini Player */}
        <MobileMiniPlayer onClick={() => setIsNowPlayingOpen(true)} />

        {/* Tab Navigation */}
        <MobileTabBar />
      </div>

      {/* Overlays */}
      {isNowPlayingOpen && (
        <MobileNowPlaying 
          onClose={() => setIsNowPlayingOpen(false)} 
          onOpenQueue={() => setIsQueueOpen(true)} 
        />
      )}
      
      {isQueueOpen && (
        <MobileQueue onClose={() => setIsQueueOpen(false)} />
      )}
    </div>
  );
};
