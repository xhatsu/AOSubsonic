import { useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../store/player.store';

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { queue, currentIndex, isPlaying, volume, nextTrack, prevTrack, pause, play } = usePlayerStore();

  const currentSong = queue[currentIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, currentSong]);

  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    
    const audio = audioRef.current;
    
    if (isPlaying) {
      audio.play().catch(console.error);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    } else {
      audio.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }, [isPlaying, currentSong]);

  // Update Media Session metadata when the song changes
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album,
        artwork: currentSong.coverArtUrl ? [
          { src: currentSong.coverArtUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: currentSong.coverArtUrl, sizes: '256x256', type: 'image/jpeg' }
        ] : []
      });
    }
  }, [currentSong]);

  // Register Media Session action handlers
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => play());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      }
    };
  }, [play, pause, prevTrack, nextTrack]);

  const preloadSongs = useMemo(() => {
    const songs = [];
    for (let i = 1; i <= 2; i++) {
      const nextSong = queue[currentIndex + i];
      if (nextSong) {
        songs.push(nextSong);
      }
    }
    return songs;
  }, [queue, currentIndex]);

  if (!currentSong) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={currentSong.streamUrl}
        onEnded={() => nextTrack()}
        onPlay={() => play()}
        onPause={() => pause()}
        id="main-audio-player" 
      />
      {preloadSongs.map((song, index) => (
        <audio
          key={`${song.id}-preload-${index}`}
          src={song.streamUrl}
          preload="auto"
        />
      ))}
    </>
  );
};
