import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store/player.store';

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { queue, currentIndex, isPlaying, volume, nextTrack, pause, play } = usePlayerStore();

  const currentSong = queue[currentIndex];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    
    const audio = audioRef.current;
    
    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying, currentSong]);

  if (!currentSong) return null;

  return (
    <audio
      ref={audioRef}
      src={currentSong.streamUrl}
      onEnded={() => nextTrack()}
      onPlay={() => play()}
      onPause={() => pause()}
      // Adding an ID for the AmLyrics component to hook into later if needed,
      // though we will use requestAnimationFrame and a custom prop instead.
      id="main-audio-player" 
    />
  );
};
