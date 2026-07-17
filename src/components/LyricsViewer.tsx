import { useEffect, useState, useRef } from 'react';
import { usePlayerStore } from '../store/player.store';
import { useUIStore } from '../store/ui.store';
import { FiRefreshCw, FiEye, FiEyeOff, FiMoon, FiDroplet, FiServer } from 'react-icons/fi';
// @ts-ignore
import LyricsPlusRenderer from '../utils/youlyplus/lyricsRenderer';
import { fetchLyrics, KPOE_SERVERS } from '../utils/lyricsFetcher';
import { companionService } from '../services/CompanionService';
import '../utils/youlyplus/lyrics.css';

const SERVERS = ['auto', ...KPOE_SERVERS];

export const LyricsViewer = () => {
  const queue = usePlayerStore((state) => state.queue);
  const currentIndex = usePlayerStore((state) => state.currentIndex);
  const currentSong = queue[currentIndex];
  const [serverIndex, setServerIndex] = useState(0);
  const themeColor = useUIStore((state) => state.themeColor);
  const showFps = useUIStore((state) => state.showFps);
  const showLyrics = useUIStore((state) => state.showLyrics);
  const toggleFps = useUIStore((state) => state.toggleFps);
  const lyricsStyle = useUIStore((state) => state.lyricsStyle);
  const setLyricsStyle = useUIStore((state) => state.setLyricsStyle);

  const rendererRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fpsRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const [forceResetKey, setForceResetKey] = useState(0);
  const [lyricsSource, setLyricsSource] = useState<string | null>(null);

  // Helper to get the audio element, caching it once found
  const getAudio = () => {
    if (!audioRef.current) {
      audioRef.current = document.getElementById('main-audio-player') as HTMLAudioElement;
    }
    return audioRef.current;
  };

  // Re-cache audio element when song changes (the <audio> element may be re-created)
  useEffect(() => {
    audioRef.current = null; // invalidate stale ref
    // Allow a tick for AudioPlayer to render the new <audio> element
    const timer = setTimeout(() => {
      audioRef.current = document.getElementById('main-audio-player') as HTMLAudioElement;
    }, 50);
    return () => clearTimeout(timer);
  }, [currentSong]);

  useEffect(() => {
    // Initialize renderer with disableNativeTick: true (matching the extension)
    if (!rendererRef.current && containerRef.current) {
      rendererRef.current = new LyricsPlusRenderer({
        patchParent: '#lyrics-mount-point',
        player: '#main-audio-player',
        buttonParent: '#lyrics-mount-point',
        selectors: ['#lyrics-mount-point'],
        disableNativeTick: true, // CRITICAL: Match the extension architecture
        getCurrentTime: () => {
          const mode = usePlayerStore.getState().playbackMode;
          if (mode === 'companion') {
            return companionService.getCurrentTime();
          }
          const audio = getAudio();
          return audio ? audio.currentTime : 0;
        }
      });
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.cleanupLyrics();
        rendererRef.current = null;
      }
    };
  }, []);

  // Run our own lightweight rAF sync loop (like songTracker.js does in the extension)
  useEffect(() => {
    if (!showLyrics) return; // CRITICAL: Detach loop and save CPU/GPU when closed

    let lastAudioTime = -1;
    let interpolatedTime = 0;
    let lastRafTime = performance.now();
    let frameCount = 0;
    let lastFpsTime = performance.now();

    const syncLoop = (time: number) => {
      const audio = getAudio();
      const renderer = rendererRef.current;
      const deltaMs = time - lastRafTime;
      lastRafTime = time;

      // FPS Calculation
      frameCount++;
      if (time - lastFpsTime >= 1000) {
        if (fpsRef.current) {
          fpsRef.current.innerText = `${frameCount} FPS`;
        }
        frameCount = 0;
        lastFpsTime = time;
      }

      if (renderer) {
        const mode = usePlayerStore.getState().playbackMode;

        if (mode === 'companion') {
          // FIX #5: In companion mode, <audio> element does not exist.
          // Use CompanionService interpolation directly.
          const companionTime = companionService.getCurrentTime();
          renderer.updateCurrentTick(companionTime);
        } else if (audio && !audio.paused) {
          const currentAudioTime = audio.currentTime;
          if (Math.abs(currentAudioTime - lastAudioTime) > 0.001) {
            interpolatedTime = currentAudioTime;
            lastAudioTime = currentAudioTime;
          } else {
            interpolatedTime += deltaMs / 1000;
          }
          if (interpolatedTime > currentAudioTime + 0.5) {
            interpolatedTime = currentAudioTime;
          }
          renderer.updateCurrentTick(interpolatedTime);
        } else if (audio) {
          renderer.updateCurrentTick(audio.currentTime);
        }
      }

      rafIdRef.current = requestAnimationFrame(syncLoop);
    };

    rafIdRef.current = requestAnimationFrame(syncLoop);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [showLyrics]);

  useEffect(() => {
    if (!currentSong || !rendererRef.current) return;

    let isMounted = true;
    const loadLyrics = async () => {
      if (rendererRef.current.cleanupLyrics) {
        rendererRef.current.cleanupLyrics(); // Clear previous
      }

      setLyricsSource('Initializing fetch...');
      
      const server = SERVERS[serverIndex];
      const fetchOptions = {
        onFetchingUrl: (url: any) => {
          if (!isMounted) return;
          try {
            const urlObj = new URL(url);
            let displayHost = urlObj.hostname.replace('www.', '');
            if (displayHost === 'api.allorigins.win') {
              const targetUrl = urlObj.searchParams.get('url');
              if (targetUrl) displayHost = new URL(targetUrl).hostname.replace('www.', '');
            }
            setLyricsSource(`Fetching: ${displayHost}...`);
          } catch (e) {
            setLyricsSource('Fetching...');
          }
        },
        forceServer: server === 'auto' ? undefined : server
      };

      const lyricsData = await fetchLyrics(currentSong, fetchOptions);

      if (!isMounted) return;

      if (lyricsData) {
        setLyricsSource(lyricsData.metadata?.source || 'Unknown');
        const settings = {
          wordByWord: true,
          relaxScroll: true,
          hideOffscreen: true, // CRITICAL: Hides 90% of DOM nodes from GPU when offscreen
          blurInactive: false,
          lightweight: true, // Reverting to false, plugin might be bugged on lightweight mode
        };
        rendererRef.current.displayLyrics(
          lyricsData,
          currentSong,
          'none',
          settings,
          null, // fetchAndDisplayLyricsFn
          null, // setCurrentDisplayModeAndRefetchFn
          'lyrics',
          0
        );
      } else {
        setLyricsSource(null);
        rendererRef.current.displaySongNotFound();
      }
    };

    loadLyrics();

    return () => {
      isMounted = false;
      if (rendererRef.current) {
        rendererRef.current.cleanupLyrics();
      }
    };
  }, [currentSong, forceResetKey, serverIndex]);

  // Update theme color for the renderer dynamically
  useEffect(() => {
    const container = document.getElementById('lyrics-plus-container');
    if (container) {
      container.style.setProperty('--lyplus-lyrics-pallete', '#ffffff');
    }
  }, [themeColor, currentSong, lyricsStyle]);

  const handleRefresh = () => {
    setForceResetKey(k => k + 1);
  };

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center overflow-hidden relative group transition-colors duration-700 ${lyricsStyle === 'clean' ? 'bg-black' : 'bg-transparent'}`}>
      {/* FPS Counter */}
      {showFps && (
        <div
          ref={fpsRef}
          className="absolute top-6 left-6 z-50 bg-black/50 text-green-400 font-mono text-sm px-3 py-1 rounded-md backdrop-blur-md border border-white/10 pointer-events-none"
        >
          0 FPS
        </div>
      )}

      {/* Top right floating buttons */}
      <div className="absolute top-6 right-6 z-50 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={toggleFps}
          className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all"
          title="Toggle FPS Counter"
        >
          {showFps ? <FiEyeOff className="text-lg" /> : <FiEye className="text-lg" />}
        </button>

        <button
          onClick={() => setLyricsStyle(lyricsStyle === 'clean' ? 'dynamic' : 'clean')}
          className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all"
          title={lyricsStyle === 'clean' ? 'Switch to Dynamic Colors' : 'Switch to Clean Mode'}
        >
          {lyricsStyle === 'clean' ? <FiDroplet className="text-lg" /> : <FiMoon className="text-lg" />}
        </button>

        {currentSong && (
          <>
            <button
              onClick={handleRefresh}
              className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all"
              title="Reload Lyrics"
            >
              <FiRefreshCw className="text-lg" />
            </button>

            <button
              onClick={() => {
                setServerIndex(prev => (prev + 1) % SERVERS.length);
              }}
              className="bg-white/10 hover:bg-white/20 text-white p-2.5 rounded-full shadow-lg backdrop-blur-md transition-all relative flex items-center justify-center"
              title={`Switch Server (Current: ${SERVERS[serverIndex]})`}
            >
              <FiServer className="text-lg" />
              {serverIndex > 0 && (
                <div className="absolute -top-1 -right-1 bg-zinc-700/80 backdrop-blur-md text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm border border-white/20">
                  {SERVERS[serverIndex].replace('https://', '').substring(0, 3).toUpperCase()}
                </div>
              )}
            </button>
          </>
        )}
      </div>

      <div
        id="lyrics-mount-point"
        ref={containerRef}
        className={`w-full h-full overflow-hidden relative z-10 ${lyricsStyle === 'clean' ? 'clean-mode-lyrics' : ''}`}
        onScroll={(e) => {
          // Sync header scroll position via CSS variable for maximum performance
          const target = e.target as HTMLDivElement;
          target.parentElement?.style.setProperty('--lyplus-scroll-top', `${target.scrollTop}px`);
        }}
        style={{
          opacity: currentSong ? 1 : 0,
          pointerEvents: currentSong ? 'auto' : 'none',
          willChange: 'scroll-position',
          isolation: 'isolate',
          transform: 'translateZ(0)'
        } as any}
      />

      {!currentSong && (
        <div className="absolute inset-0 flex items-center justify-center z-10 text-zinc-500">
          No track playing
        </div>
      )}

      {/* Lyrics Source Pill */}
      {lyricsSource && currentSong && (
        <div className="absolute bottom-[100px] right-6 z-[999] opacity-0 group-hover:opacity-80 hover:!opacity-100 transition-all duration-300 flex items-center gap-2 bg-zinc-950/80 backdrop-blur-md border border-white/10 shadow-lg rounded-full px-3 py-1.5 text-xs text-white/90">
          {lyricsSource.startsWith('Fetching') ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : null}
          <span className="cursor-default">
            {lyricsSource.startsWith('Fetching') ? lyricsSource : `Source: ${lyricsSource}`}
          </span>
        </div>
      )}
    </div>
  );
};
