import { useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../store/player.store';
import { useHistoryStore } from '../store/history.store';
import { companionService } from '../services/CompanionService';

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { queue, currentIndex, isPlaying, volume, nextTrack, prevTrack, pause, play, playbackMode, setCompanionConnected } = usePlayerStore();
  const currentSong = queue[currentIndex];

  useEffect(() => {
    if (playbackMode !== 'companion') return;

    const existingAudio = document.getElementById('main-audio-player') as HTMLAudioElement;
    if (existingAudio) existingAudio.pause();

    companionService.connect();

    const unsubConnection = companionService.onConnectionChange((connected, info) => {
      setCompanionConnected(connected, info);
      if (!connected) {
        usePlayerStore.getState().resetCurrentSong();
      }
    });

    const unsubTrackEnded = companionService.onTrackEnded(() => {
      const song = usePlayerStore.getState().queue[usePlayerStore.getState().currentIndex];
      if (song) {
        useHistoryStore.getState().recordPlay({
          id: song.id, title: song.title, artist: song.artist,
          album: song.album, duration: song.duration, coverArt: song.coverArtUrl
        });
      }
      nextTrack();
    });

    const unsubState = companionService.onStateChange((state) => {
      if (state === 'playing') play();
      if (state === 'paused') pause();
    });

    return () => {
      unsubConnection();
      unsubTrackEnded();
      unsubState();
      companionService.disconnect();
      setCompanionConnected(false);
    };
  }, [playbackMode]);

  useEffect(() => {
    // Leave WASAPI untouched (linear raw percentage).
    // Apply a steep quartic curve (volume^4) to the Browser to heavily reduce its output.
    if (playbackMode === 'companion') {
      companionService.setVolume(volume * 100);
    } else if (audioRef.current) {
      audioRef.current.volume = Math.pow(volume, 3);
    }
  }, [volume, currentSong, playbackMode]);

  const lastPlayedIdRef = useRef<string | null>(null);
  const companionConnected = usePlayerStore(state => state.companionConnected);

  // Clear the tracked loaded song when switching out of companion mode
  useEffect(() => {
    if (playbackMode !== 'companion') {
      lastPlayedIdRef.current = null;
    }
  }, [playbackMode]);

  useEffect(() => {
    if (!currentSong) {
      if (playbackMode === 'companion') {
        companionService.stop();
      } else {
        const audio = audioRef.current;
        if (audio) {
          audio.pause();
          audio.removeAttribute('src');
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        }
      }
      return;
    }
    
    if (playbackMode === 'companion') {
      if (isPlaying) {
        // If we haven't actually loaded this track into the companion daemon yet, load it now!
        if (lastPlayedIdRef.current !== currentSong.id) {
          if (companionConnected) {
            companionService.play(currentSong.streamUrl);
            lastPlayedIdRef.current = currentSong.id;
          }
        } else {
          companionService.resume();
        }
      } else {
        companionService.pause();
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      if (isPlaying) {
        audio.play().catch(console.error);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      } else {
        audio.pause();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      }
    }
  }, [isPlaying, currentSong, playbackMode, companionConnected]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      if (playbackMode === 'companion') {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
      } else if (currentSong) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentSong.title, artist: currentSong.artist, album: currentSong.album,
          artwork: currentSong.coverArtUrl ? [
            { src: currentSong.coverArtUrl, sizes: '512x512', type: 'image/jpeg' },
            { src: currentSong.coverArtUrl, sizes: '256x256', type: 'image/jpeg' }
          ] : []
        });
      }
    }
  }, [currentSong, playbackMode]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    }
    return () => {
      if ('mediaSession' in navigator) {
        ['play', 'pause', 'previoustrack', 'nexttrack'].forEach(a =>
          navigator.mediaSession.setActionHandler(a as MediaSessionAction, null));
      }
    };
  }, [play, pause, prevTrack, nextTrack]);

  const preloadSongs = useMemo(() => {
    if (playbackMode === 'companion') return [];
    const songs = [];
    for (let i = 1; i <= 2; i++) {
      if (queue[currentIndex + i]) songs.push(queue[currentIndex + i]);
    }
    return songs;
  }, [queue, currentIndex, playbackMode]);

  if (!currentSong || playbackMode === 'companion') return null;

  return (
    <>
      <audio
        ref={audioRef} src={currentSong.streamUrl}
        onEnded={() => {
          useHistoryStore.getState().recordPlay({
            id: currentSong.id, title: currentSong.title, artist: currentSong.artist,
            album: currentSong.album, duration: currentSong.duration, coverArt: currentSong.coverArtUrl
          });
          nextTrack();
        }}
        onPlay={() => play()} onPause={() => pause()}
        id="main-audio-player"
      />
      {preloadSongs.map((song, i) => (
        <audio key={`${song.id}-preload-${i}`} src={song.streamUrl} preload="auto" />
      ))}
    </>
  );
};
