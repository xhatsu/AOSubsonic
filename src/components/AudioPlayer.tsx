import { useEffect, useRef, useMemo } from 'react';
import { usePlayerStore } from '../store/player.store';

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { queue, currentIndex, isPlaying, volume, nextTrack, pause, play } = usePlayerStore();

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
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong]);

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
