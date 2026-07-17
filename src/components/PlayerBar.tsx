import { useState, useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../store/player.store';
import { useUIStore } from '../store/ui.store';
import { FiPlay, FiPause, FiSkipForward, FiSkipBack, FiVolume2, FiMic, FiMaximize2, FiList, FiShuffle, FiRadio } from 'react-icons/fi';
import { CachedImage } from './CachedImage';
import { companionService } from '../services/CompanionService';
import { useAuthStore } from '../store/auth.store';
import { SubsonicController } from '../api/subsonic';
export const TrackProgressBar = ({ duration: propDuration }: { duration: number }) => {
  const [audioDuration, setAudioDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);

  const playbackMode = usePlayerStore(state => state.playbackMode);

  // Reset audio duration when a new song starts or mode changes
  useEffect(() => {
    setAudioDuration(0);
  }, [propDuration, playbackMode]);

  useEffect(() => {
    audioRef.current = document.getElementById('main-audio-player') as HTMLAudioElement;

    let animationFrameId: number;
    const updateTime = () => {
      const mode = usePlayerStore.getState().playbackMode;
      if (mode === 'companion') {
        if (!isDragging && inputRef.current && timeDisplayRef.current) {
          const currentT = companionService.getRawPosition();
          inputRef.current.value = currentT.toString();
          timeDisplayRef.current.innerText = formatTime(currentT);
        }
        const dur = companionService.getDuration();
        if (dur > 0) setAudioDuration(dur);
      } else {
        if (!audioRef.current || !document.body.contains(audioRef.current)) {
          audioRef.current = document.getElementById('main-audio-player') as HTMLAudioElement;
        }
        if (audioRef.current) {
          if (!isDragging && inputRef.current && timeDisplayRef.current) {
            const currentT = audioRef.current.currentTime;
            inputRef.current.value = currentT.toString();
            timeDisplayRef.current.innerText = formatTime(currentT);
          }
          const realDuration = audioRef.current.duration;
          if (realDuration && !isNaN(realDuration) && realDuration !== Infinity) {
            setAudioDuration(realDuration);
          }
        }
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };

    animationFrameId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isDragging]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (timeDisplayRef.current) {
      timeDisplayRef.current.innerText = formatTime(parseFloat(e.target.value));
    }
  };

  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    setIsDragging(false);
    const targetTime = parseFloat((e.target as HTMLInputElement).value);
    const mode = usePlayerStore.getState().playbackMode;
    if (mode === 'companion') {
      companionService.seek(targetTime);
    } else {
      let audio = audioRef.current;
      if (!audio || !document.body.contains(audio)) {
        audio = document.getElementById('main-audio-player') as HTMLAudioElement;
        audioRef.current = audio;
      }
      if (audio) {
        audio.currentTime = targetTime;
      }
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const finalDuration = audioDuration > 0 ? audioDuration : propDuration;

  return (
    <div className="flex items-center w-full space-x-3 text-xs text-zinc-400 mt-2 max-w-md">
      <span ref={timeDisplayRef} className="w-10 text-right">0:00</span>
      <input
        ref={inputRef}
        type="range"
        min="0"
        max={finalDuration || 100}
        step="0.1"
        defaultValue={0}
        onChange={handleSeekChange}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={handleSeekEnd}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={handleSeekEnd}
        className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <span className="w-10">{formatTime(finalDuration)}</span>
    </div>
  );
};

export const PlayerBar = () => {
  const { queue, currentIndex, isPlaying, togglePlay, nextTrack, prevTrack, shuffleQueue, volume, setVolume, showQueue, toggleQueue, addListToQueue } = usePlayerStore();
  const { showLyrics, toggleLyrics } = useUIStore();
  const currentSong = queue[currentIndex];

  const [isRadioLoading, setIsRadioLoading] = useState(false);
  const config = useAuthStore(state => state.config);
  const ctrl = useMemo(() => config ? new SubsonicController(config) : null, [config]);

  const handleRadio = async () => {
    if (!currentSong || !ctrl || isRadioLoading) return;
    setIsRadioLoading(true);
    try {
      const { languageStrictness, radioAlgorithm } = useUIStore.getState();

      if (radioAlgorithm === 'chain') {
        const originalSeedId = currentSong.id;
        let currentSeedId = originalSeedId;
        const currentQueueIds = usePlayerStore.getState().queue.map(s => s.id);
        const excludeIds = new Set(currentQueueIds);
        const recentChainIds: string[] = [];

        for (let i = 0; i < 15; i++) {
          const excludeStr = Array.from(excludeIds).join(',');
          const recentStr = recentChainIds.slice(-5).join(',');
          const res = await fetch(`/api/radio/chain-next/${currentSeedId}?original=${originalSeedId}&exclude=${excludeStr}&strictness=${languageStrictness}&recent=${recentStr}`);
          if (!res.ok) {
            if (i === 0) alert('Smart Radio not set up. Run the admin enrichment tool first.');
            break;
          }
          const data = await res.json();
          if (!data.song) break; // no more candidates

          excludeIds.add(data.song.id);

          try {
            const songRes = await ctrl.getSong(data.song.id);
            const song = songRes.song;
            if (song) {
              usePlayerStore.getState().addToQueue({
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                duration: song.duration,
                streamUrl: ctrl.getStreamUrl(song.id),
                coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
              });
              currentSeedId = song.id;
              recentChainIds.push(song.id);
            }
          } catch (e) { }
        }
      } else {
        const res = await fetch(`/api/radio/similar/${currentSong.id}?strictness=${languageStrictness}&count=15`);
        if (!res.ok) {
          alert('Smart Radio not set up. Run the admin enrichment tool first.');
          return;
        }
        const data = await res.json();
        const songs = [];
        for (const item of data.songs) {
          try {
            const songRes = await ctrl.getSong(item.id);
            const song = songRes.song;
            if (song) {
              songs.push({
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                duration: song.duration,
                streamUrl: ctrl.getStreamUrl(song.id),
                coverArtUrl: song.coverArt ? ctrl.getCoverArtUrl(song.coverArt) : undefined
              });
            }
          } catch (e) { }
        }
        if (songs.length > 0) {
          addListToQueue(songs);
        }
      }
    } catch (e) {
      console.error('Radio error:', e);
    } finally {
      setIsRadioLoading(false);
    }
  };

  return (
    <div className="h-24 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-6 z-[120] relative">
      {/* Track Info */}
      <div className="flex items-center w-1/3">
        <div className="w-14 h-14 bg-zinc-800 rounded-md overflow-hidden flex-shrink-0 shadow-lg relative group">
          {currentSong?.coverArtUrl ? (
            <CachedImage id={currentSong.album} url={currentSong.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-500">
              <FiMaximize2 />
            </div>
          )}
          {currentSong && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm" onClick={toggleLyrics}>
              <FiMaximize2 className="text-white text-xl" />
            </div>
          )}
        </div>
        <div className="ml-4 truncate">
          <div className="text-white font-medium text-sm truncate">{currentSong?.title || 'No track playing'}</div>
          <div className="text-zinc-400 text-xs truncate mt-1">{currentSong ? `${currentSong.artist} • ${currentSong.album}` : ''}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col items-center justify-center w-1/3">
        <div className={`flex items-center space-x-6 ${!currentSong ? 'opacity-50 pointer-events-none' : ''}`}>
          <button onClick={handleRadio} disabled={!currentSong || isRadioLoading} className={`text-zinc-400 hover:text-white transition-colors ${isRadioLoading ? 'animate-pulse text-primary' : ''}`} title="Smart Radio — Find similar songs">
            <FiRadio className="text-lg" />
          </button>
          <button onClick={shuffleQueue} className="text-zinc-400 hover:text-white transition-colors" title="Shuffle Queue">
            <FiShuffle className="text-lg" />
          </button>
          <button onClick={prevTrack} className="text-zinc-400 hover:text-white transition-colors">
            <FiSkipBack className="text-xl" />
          </button>
          <button
            onClick={togglePlay}
            className="w-10 h-10 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
          >
            {isPlaying ? <FiPause className="text-xl" /> : <FiPlay className="text-xl ml-1" />}
          </button>
          <button onClick={nextTrack} className="text-zinc-400 hover:text-white transition-colors">
            <FiSkipForward className="text-xl" />
          </button>
        </div>
        <TrackProgressBar duration={currentSong?.duration || 0} />
      </div>

      {/* Volume & Toggles */}
      <div className="flex items-center justify-end w-1/3 space-x-6">
        <button
          onClick={toggleQueue}
          className={`transition-colors ${showQueue ? 'text-primary' : 'text-zinc-400 hover:text-white'}`}
          title="Toggle Queue"
        >
          <FiList className="text-xl" />
        </button>

        <button
          onClick={toggleLyrics}
          className={`transition-colors ${showLyrics ? 'text-primary' : 'text-zinc-400 hover:text-white'}`}
          title="Toggle Lyrics"
        >
          <FiMic className="text-xl" />
        </button>

        <div className="flex items-center space-x-3">
          <FiVolume2 className="text-zinc-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-24 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>

        {usePlayerStore.getState().playbackMode === 'companion' && (
          <div className="flex items-center ml-3" title={usePlayerStore.getState().companionConnected ? 'WASAPI: Connected' : 'WASAPI: Disconnected'}>
            <div className={`w-2 h-2 rounded-full transition-colors ${usePlayerStore.getState().companionConnected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
          </div>
        )}
      </div>
    </div>
  );
};
