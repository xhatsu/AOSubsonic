import { usePlayerStore } from '../store/player.store';
import { companionService } from '../services/CompanionService';
import { FiMonitor, FiWifi, FiClock } from 'react-icons/fi';

export const PlaybackSettings = () => {
  const {
    playbackMode, setPlaybackMode,
    companionConnected, companionInfo,
    lyricsOffsetMs, setLyricsOffsetMs,
    setCompanionConfig,
  } = usePlayerStore();

  const handleModeChange = (mode: 'browser' | 'companion') => {
    const store = usePlayerStore.getState();
    store.pause();
    store.resetCurrentSong(); // Clear the now playing song to hide the player bar, but keep the queue
    setPlaybackMode(mode);

    if (mode === 'companion') {
      companionService.connect();
      // stop immediately if connected
      const unsub = companionService.onConnectionChange((connected) => {
        if (connected) {
          companionService.stop();
          unsub();
        }
      });
    } else {
      // Stop companion playback before disconnecting to release WASAPI Exclusive lock
      companionService.stop();
      companionService.disconnect();
      setTimeout(() => {
        const audio = document.getElementById('main-audio-player') as HTMLAudioElement;
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      }, 100);
    }
  };

  const handleOffsetChange = (ms: number) => {
    setLyricsOffsetMs(ms);
    companionService.setLyricsOffsetMs(ms);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white">Playback Output</h3>

      <div className="flex gap-3">
        <button
          onClick={() => handleModeChange('browser')}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
            playbackMode === 'browser'
              ? 'border-primary bg-primary/20 text-white'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500'
          }`}
        >
          <FiMonitor className="text-lg" />
          <div className="text-left">
            <div className="font-medium text-sm">Browser</div>
            <div className="text-xs opacity-70">HTML5 Audio</div>
          </div>
        </button>

        <button
          onClick={() => handleModeChange('companion')}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
            playbackMode === 'companion'
              ? 'border-primary bg-primary/20 text-white'
              : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500'
          }`}
        >
          <FiWifi className="text-lg" />
          <div className="text-left">
            <div className="font-medium text-sm">Companion (WASAPI)</div>
            <div className="text-xs opacity-70">Bit-perfect via mpv</div>
          </div>
        </button>
      </div>

      {playbackMode === 'companion' && (
        <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${companionConnected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
              <span className="text-sm text-zinc-300">
                {companionConnected ? 'Connected to Companion Daemon' : 'Disconnected — start companion-daemon.exe'}
              </span>
            </div>
            {companionInfo && (
              <div className="text-xs text-zinc-500">
                Daemon v{companionInfo.version} · mpv: {companionInfo.mpvVersion}
              </div>
            )}
            {!companionConnected && (
              <p className="text-xs text-zinc-500">
                Install the Companion Daemon and mpv. See the mpv install guide included in the daemon folder.
              </p>
            )}
          </div>

          {companionConnected && companionInfo && (
            <div className="space-y-4 pt-4 border-t border-zinc-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usePlayerStore.getState().companionConfig.wasapiExclusive}
                  onChange={(e) => {
                    const newCfg = { ...usePlayerStore.getState().companionConfig, wasapiExclusive: e.target.checked };
                    setCompanionConfig(newCfg);
                    companionService.setConfig(newCfg.wasapiExclusive, newCfg.wasapiDevice);
                  }}
                  className="w-4 h-4 text-primary bg-zinc-900 border-zinc-700 rounded focus:ring-primary focus:ring-offset-zinc-900"
                />
                <div>
                  <div className="text-sm font-medium text-white">Enable WASAPI Exclusive Mode</div>
                  <div className="text-xs text-zinc-500">Bypasses the Windows mixer for bit-perfect audio. May prevent other apps from playing sound. Disable this if songs fail to play.</div>
                </div>
              </label>

              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Specific Audio Device (Optional)
                </label>
                <div className="text-xs text-zinc-500 mb-2">Leave blank for default. Type the exact name of the endpoint (e.g., "Speakers (FiiO K5 Pro)")</div>
                <input
                  type="text"
                  placeholder="Default Device"
                  defaultValue={usePlayerStore.getState().companionConfig.wasapiDevice}
                  onBlur={(e) => {
                    const newCfg = { ...usePlayerStore.getState().companionConfig, wasapiDevice: e.target.value };
                    setCompanionConfig(newCfg);
                    companionService.setConfig(newCfg.wasapiExclusive, newCfg.wasapiDevice);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-primary focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FiClock className="text-zinc-400" />
          <h3 className="text-lg font-semibold text-white">Lyrics Sync Offset</h3>
        </div>
        <p className="text-xs text-zinc-500">
          Adjust if lyrics are out of sync. Positive = lyrics appear later, negative = earlier.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range" min={-2000} max={2000} step={10}
            value={lyricsOffsetMs}
            onChange={(e) => handleOffsetChange(parseInt(e.target.value, 10))}
            className="flex-1 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex items-center gap-2">
            <input
              type="number" value={lyricsOffsetMs}
              onChange={(e) => handleOffsetChange(parseInt(e.target.value, 10) || 0)}
              className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white text-center"
              min={-5000} max={5000} step={10}
            />
            <span className="text-xs text-zinc-500">ms</span>
          </div>
        </div>
        <button onClick={() => handleOffsetChange(0)} className="text-xs text-zinc-500 hover:text-white transition-colors">
          Reset to 0
        </button>
      </div>
    </div>
  );
};
