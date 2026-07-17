import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { useHistoryStore } from '../store/history.store';
import { usePlayerStore, type QueueSong } from '../store/player.store';
import { 
  useGetFrequentAlbums, 
  useGetRecentAlbums, 
  useGetAlbumsByYear, 
  useGetStarred2,
  useGetRandomSongsQuery
} from '../api/hooks';
import { SubsonicController } from '../api/subsonic';
import { CachedImage } from './CachedImage';
import { FiPlay, FiActivity, FiRefreshCw, FiSliders, FiShuffle } from 'react-icons/fi';
import { MoodTrackList } from './MoodTrackList';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';
import { Vibrant } from 'node-vibrant/browser';
import { LLMService } from '../services/llm.service';

const ScrollRow = ({ title, children, onRefresh }: { title: string, children: React.ReactNode, onRefresh?: () => void }) => {
  const scrollRef = useHorizontalScroll<HTMLDivElement>();
  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {title}
        </h2>
        {onRefresh && (
          <button onClick={onRefresh} className="text-zinc-400 hover:text-white transition-colors">
            <FiActivity />
          </button>
        )}
      </div>
      <div ref={scrollRef} className="flex space-x-4 overflow-x-auto scrollbar-thin pb-4 snap-x px-2">
        {children}
      </div>
    </div>
  );
};

export const HomePage = () => {
  const config = useAuthStore(state => state.config);
  const ctrl = useMemo(() => config ? new SubsonicController(config) : null, [config]);
  const { setView, setSelectedAlbumId, setSelectedAlbumCover, llmApiKey } = useUIStore();
  const history = useHistoryStore();
  const { setQueue, play } = usePlayerStore();
  

  const yearBtnScrollRef = useHorizontalScroll<HTMLDivElement>();
  const yearAlbumsScrollRef = useHorizontalScroll<HTMLDivElement>();

  // For You Sliders State
  const [sliders, setSliders] = useState({
    tempo: 0.5, vocal: 0.5, mood: 0.5, acousticness: 0.5, distortion: 0.5, setting: 0.5
  });
  const { homeForYouData: forYouData, setHomeForYouData } = useUIStore();
  
  const setForYouData = (updater: any) => {
    setHomeForYouData(typeof updater === 'function' ? updater(forYouData) : updater);
  };
  
  const [isFetchingForYou, setIsFetchingForYou] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState("");
  const [isMagicTuning, setIsMagicTuning] = useState(false);

  // Spotlight State
  const [spotlightColor, setSpotlightColor] = useState<string | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // API Data
  const { data: frequentData } = useGetFrequentAlbums(15);
  const { data: recentData } = useGetRecentAlbums(15);
  const { data: starredData } = useGetStarred2();
  const { data: randomSongsData } = useGetRandomSongsQuery(10);
  
  const topAlbums = frequentData?.albumList?.album?.slice(0, 5) || recentData?.albumList?.album?.slice(0, 5) || [];
  const topAlbum = topAlbums[spotlightIndex] || topAlbums[0];

  // Set a random initial spotlight index when data loads
  useEffect(() => {
    if (topAlbums.length > 0 && spotlightIndex === 0) {
      setSpotlightIndex(Math.floor(Math.random() * topAlbums.length));
    }
  }, [topAlbums.length]);

  useEffect(() => {
    if (topAlbum?.coverArt && ctrl) {
      const cacheKey = `spotlight_color_${topAlbum.coverArt}`;
      const cachedColor = localStorage.getItem(cacheKey);
      
      // Instantly load cached color if available to prevent UI pop-in
      if (cachedColor) {
        setSpotlightColor(cachedColor);
        return; // Don't run expensive Vibrant extraction again if we already have it
      }

      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = ctrl.getCoverArtUrl(topAlbum.coverArt);
      img.onload = () => {
        Vibrant.from(img).clearFilters().getPalette().then(palette => {
          // Extract all valid swatches and sort by population to find the true dominant color
          const swatches = Object.values(palette).filter(s => s !== null);
          if (swatches.length > 0) {
            swatches.sort((a, b) => b!.population - a!.population);
            const hex = swatches[0]!.hex;
            if (hex !== cachedColor) {
                setSpotlightColor(hex);
                localStorage.setItem(cacheKey, hex);
            }
          } else if (!cachedColor) {
            setSpotlightColor(null);
          }
        }).catch(err => console.error("Vibrant error:", err));
      };
    } else {
      setSpotlightColor(null);
    }
  }, [topAlbum?.coverArt, ctrl]);

  // Year Selection
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const { data: yearAlbumsData } = useGetAlbumsByYear(selectedYear, selectedYear, 20);
  const years = Array.from({ length: 30 }, (_, i) => currentYear - i);

  const fetchAutoSections = async (frequentAlbums?: any[]) => {
    setIsFetchingForYou(true);
    try {
      const q = new URLSearchParams();
      if (frequentAlbums && frequentAlbums.length > 0) {
        const albumTitles = frequentAlbums.map((a: any) => a.title || a.name).join('|||');
        q.append('frequentAlbums', albumTitles);
      }
      const res = await fetch('/api/radio/foryou?' + q.toString());
      if (res.ok) {
        const data = await res.json();
        setForYouData((prev: any[]) => {
          const oldSliderSection = prev ? prev.find((s: any) => s.type === 'slider') : null;
          return [oldSliderSection, ...data.sections].filter(Boolean);
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingForYou(false);
    }
  };

  useEffect(() => {
    if (forYouData) return;
    
    if (frequentData?.albumList?.album) {
      fetchAutoSections(frequentData.albumList.album);
    } else {
      fetchAutoSections([]);
    }
  }, [frequentData]);

  const handleSliderChange = (axis: string, val: number) => {
    const newSliders = { ...sliders, [axis]: val };
    setSliders(newSliders);
  };

  const applySliders = async () => {
    const { llmApiKey } = useUIStore.getState();
    if (!llmApiKey) {
      alert("Please set your OpenRouter API key in AI Settings first to use custom tuning!");
      return;
    }
    
    setIsFetchingForYou(true);
    try {
      const parts = [];
      if (sliders.tempo > 0.7) parts.push("fast tempo, high energy");
      else if (sliders.tempo < 0.3) parts.push("slow tempo, relaxed pace");
      else parts.push("moderate tempo");

      if (sliders.vocal > 0.7) parts.push("layered vocals, vocal-heavy");
      else if (sliders.vocal < 0.3) parts.push("instrumental, no vocals");
      else parts.push("balanced vocals");

      if (sliders.mood > 0.7) parts.push("bright, uplifting, cheerful");
      else if (sliders.mood < 0.3) parts.push("dark, melancholic, brooding");
      else parts.push("neutral mood");

      if (sliders.acousticness > 0.7) parts.push("organic, acoustic instruments");
      else if (sliders.acousticness < 0.3) parts.push("electronic, synth-heavy, digital");
      else parts.push("mixed acoustic and electronic");

      if (sliders.distortion > 0.7) parts.push("raw, distorted, heavy");
      else if (sliders.distortion < 0.3) parts.push("clean production, polished");
      else parts.push("moderate grit");

      if (sliders.setting > 0.7) parts.push("social, party, upbeat crowd");
      else if (sliders.setting < 0.3) parts.push("introspective, solo listening");
      else parts.push("versatile setting");

      const promptStr = parts.join(", ");
      const vector = await LLMService.generateEmbedding(promptStr, llmApiKey);
      
      const res = await fetch('/api/radio/prompt?count=30', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector })
      });
      
      if (res.ok) {
        const data = await res.json();
        const newSliderSection = {
          type: 'slider',
          title: "Custom Tuned Mix",
          description: `Vibe: ${promptStr}`,
          songs: data.songs
        };
        
        setForYouData((prev: any[]) => {
          const oldAutoSections = prev ? prev.filter((s: any) => s.type === 'auto') : [];
          return [newSliderSection, ...oldAutoSections].filter(Boolean);
        });
      }
    } catch (e) {
      console.error(e);
      alert("Failed to apply sliders. Check console.");
    } finally {
      setIsFetchingForYou(false);
    }
  };

  const handleMagicTune = async () => {
    if (!magicPrompt.trim()) return;
    setIsMagicTuning(true);
    try {
      const { llmApiKey } = useUIStore.getState();
      if (!llmApiKey) {
        alert("Please set your OpenRouter API key in AI Settings first!");
        setIsMagicTuning(false);
        return;
      }
      
      const vector = await LLMService.generateEmbedding(magicPrompt, llmApiKey);
      
      const res = await fetch('/api/radio/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector })
      });
      
      if (!res.ok) throw new Error("Failed to get prompt radio");
      const data = await res.json();
      
      const newSection = {
        type: 'slider',
        title: "Magic Vibe",
        description: `Based on: "${magicPrompt}"`,
        songs: data.songs
      };
      
      setForYouData((prev: any[]) => {
        if (!prev) return [newSection];
        const oldAutoSections = prev.filter((s: any) => s.type === 'auto');
        return [newSection, ...oldAutoSections].filter(Boolean);
      });
    } catch (e) {
      console.error(e);
      alert("Magic Tune failed. Check console for details.");
    } finally {
      setIsMagicTuning(false);
    }
  };

  const handleOpenAlbum = (id: string, coverArt: string) => {
    setSelectedAlbumId(id);
    setSelectedAlbumCover(coverArt);
    setView('albumDetail');
  };

  const playSongList = async (songIds: string[]) => {
    if (!ctrl) return;
    const songs: QueueSong[] = [];
    for (const id of songIds) {
      try {
        const res = await ctrl.getSong(id);
        const song = res.song;
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
      } catch (e) {
        console.error("Failed to load song", id, e);
      }
    }
    if (songs.length > 0) {
      setQueue(songs, 0);
      play();
    }
  };


  return (
    <div className="flex-1 overflow-y-auto h-full p-6 pb-32 scrollbar-thin">
      
      {/* Spotlight Banner */}
      <div 
        className={`mb-12 mt-2 relative w-full h-[300px] md:h-[400px] rounded-3xl overflow-hidden shadow-2xl flex ${!spotlightColor ? 'bg-primary' : ''}`}
        style={spotlightColor ? { backgroundColor: spotlightColor } : undefined}
      >
        {(() => {
          if (!topAlbum) return (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/50">
              <span className="text-2xl font-bold">Welcome to AOSubsonic</span>
            </div>
          );
          
          return (
            <>
              {/* Left Content */}
              <div className="w-full md:w-3/5 p-8 md:p-12 flex flex-col justify-center relative z-10">
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-0"></div>
                <div className="relative z-10">
                  <div className="flex items-center space-x-2 text-white/90 mb-4 font-semibold tracking-widest uppercase text-xs">
                    <span>Spotlight</span>
                  </div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 tracking-tight leading-tight line-clamp-2">
                    {topAlbum.name || topAlbum.title}
                  </h1>
                  <p className="text-lg md:text-xl text-white/90 font-medium mb-8 max-w-lg">
                    {topAlbum.artist}
                  </p>
                  <div>
                    <button 
                      onClick={() => handleOpenAlbum(topAlbum.id, topAlbum.coverArt)}
                      className="bg-white text-black hover:bg-zinc-200 font-bold px-8 py-3.5 rounded-full transition-transform hover:scale-105 active:scale-95 shadow-lg flex items-center"
                    >
                      Listen Now
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Right Image */}
              <div className="absolute top-0 right-0 w-full h-full md:w-2/3 z-0">
                {topAlbum.coverArt && ctrl && (
                   <CachedImage id={topAlbum.coverArt} url={ctrl.getCoverArtUrl(topAlbum.coverArt)} alt={topAlbum.title} className="w-full h-full object-cover object-center md:object-right" />
                )}
                {/* Gradient to blend image into the solid background on large screens */}
                {spotlightColor ? (
                  <div 
                    className="hidden md:block absolute inset-0" 
                    style={{ backgroundImage: `linear-gradient(to right, ${spotlightColor} 0%, ${spotlightColor}00 70%, ${spotlightColor}00 100%)` }}
                  ></div>
                ) : (
                  <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-primary via-transparent to-transparent"></div>
                )}
              </div>

              {/* Pagination Dots */}
              {topAlbums.length > 1 && (
                <div className="absolute bottom-6 left-0 w-full flex justify-center space-x-2 z-20">
                  {topAlbums.map((_: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpotlightIndex(idx);
                      }}
                      className={`h-2 rounded-full transition-all ${idx === spotlightIndex ? 'bg-white w-6' : 'bg-white/50 hover:bg-white/80 w-2'}`}
                    />
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* For You / Slider Recommendations */}
      <div className="mb-12">
        <div className="relative p-6 rounded-3xl bg-zinc-900/80 border border-white/10 shadow-2xl overflow-hidden mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <FiSliders className="text-primary" /> Tune Your Vibe
            </h2>
            <button 
              onClick={applySliders}
              className="flex items-center gap-2 bg-white text-black hover:bg-zinc-200 px-6 py-2 rounded-full font-bold transition-colors text-sm shadow-lg"
            >
              <FiShuffle className="hidden" /> Apply
            </button>
          </div>
          
          {llmApiKey && (
            <div className="mb-6 relative flex items-center">
              <input
                type="text"
                placeholder="Magic Vibe: Describe what you want to hear (e.g. 'upbeat workout mix')"
                value={magicPrompt}
                onChange={(e) => setMagicPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMagicTune()}
                className="w-full bg-white/10 text-white placeholder-zinc-400 px-6 py-3 rounded-full outline-none focus:ring-2 focus:ring-white/50 border border-white/10 transition-all"
                disabled={isMagicTuning}
              />
              <button 
                onClick={handleMagicTune}
                disabled={isMagicTuning}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white hover:bg-zinc-200 text-black px-4 py-1.5 rounded-full font-bold text-sm shadow-md transition-all disabled:opacity-50"
              >
                {isMagicTuning ? "Tuning..." : "Magic"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {[
              { axis: 'tempo', left: 'Slow', right: 'Fast' },
              { axis: 'vocal', left: 'Instrumental', right: 'Layered' },
              { axis: 'mood', left: 'Dark', right: 'Bright' },
              { axis: 'acousticness', left: 'Synth', right: 'Organic' },
              { axis: 'distortion', left: 'Clean', right: 'Raw' },
              { axis: 'setting', left: 'Solo', right: 'Social' }
            ].map(slider => (
              <div key={slider.axis} className="flex flex-col space-y-2">
                <div className="flex justify-between text-xs font-medium text-zinc-400">
                  <span className={sliders[slider.axis as keyof typeof sliders] < 0.3 ? 'text-white' : ''}>{slider.left}</span>
                  <span className="capitalize text-zinc-500">{slider.axis}</span>
                  <span className={sliders[slider.axis as keyof typeof sliders] > 0.7 ? 'text-white' : ''}>{slider.right}</span>
                </div>
                <input 
                  type="range" 
                  min="0" max="1" step="0.05"
                  value={sliders[slider.axis as keyof typeof sliders]}
                  onChange={(e) => handleSliderChange(slider.axis, parseFloat(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none bg-zinc-800 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                />
              </div>
            ))}
          </div>
        </div>

        {isFetchingForYou && !forYouData && (
          <div className="text-center py-12">
            <FiRefreshCw className="animate-spin text-3xl text-primary mx-auto mb-4" />
            <p className="text-zinc-400">Tuning your frequency...</p>
          </div>
        )}

        {forYouData && forYouData.map((section: any, idx: number) => {
          if (!section.songs || section.songs.length === 0) return null;
          return (
            <MoodTrackList 
              key={`fy-${idx}`}
              title={section.title}
              description={section.description}
              songIds={section.songs.map((s:any) => s.id)}
              onPlayAll={() => playSongList(section.songs.map((s:any) => s.id))}
              layout="row"
            />
          );
        })}
      </div>

      {/* Most Played */}
      <ScrollRow title="Most Played">
        {(frequentData?.albumList?.album || []).map((album: any) => (
          <div key={`freq-${album.id}`} className="w-40 flex-shrink-0 snap-start group cursor-pointer" onClick={() => handleOpenAlbum(album.id, album.coverArt)}>
            <div className="aspect-square bg-zinc-800 rounded-xl mb-3 relative overflow-hidden shadow-md">
              {album.coverArt && ctrl && <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-all">
                  <FiPlay className="text-white fill-white ml-1" />
                </div>
              </div>
            </div>
            <div className="font-bold text-white text-sm truncate">{album.name || album.title}</div>
            <div className="text-xs text-zinc-400 truncate mt-1">{album.artist}</div>
          </div>
        ))}
      </ScrollRow>

      {/* Recently Played */}
      <ScrollRow title="Recently Played">
        {(recentData?.albumList?.album || []).map((album: any) => (
          <div key={`rec-${album.id}`} className="w-40 flex-shrink-0 snap-start group cursor-pointer" onClick={() => handleOpenAlbum(album.id, album.coverArt)}>
            <div className="aspect-square bg-zinc-800 rounded-xl mb-3 relative overflow-hidden shadow-md">
              {album.coverArt && ctrl && <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-all">
                  <FiPlay className="text-white fill-white ml-1" />
                </div>
              </div>
            </div>
            <div className="font-bold text-white text-sm truncate">{album.name || album.title}</div>
            <div className="text-xs text-zinc-400 truncate mt-1">{album.artist}</div>
          </div>
        ))}
      </ScrollRow>

      {/* Rediscover / Forgotten Gems */}
      {randomSongsData?.randomSongs?.song && randomSongsData.randomSongs.song.length > 0 && (
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-white px-2 mb-6 tracking-tight">
            Rediscover
          </h2>
          <div className="space-y-2 px-2">
            {randomSongsData.randomSongs.song.map((song: any, index: number) => (
              <div key={`random-${song.id}-${index}`} onClick={() => playSongList([song.id])} className="flex items-center p-3 hover:bg-zinc-800/50 rounded-xl cursor-pointer transition-colors group">
                <div className="w-8 text-center font-bold mr-2 text-zinc-600">
                  <FiActivity className="mx-auto" />
                </div>
                <div className="w-12 h-12 bg-zinc-800 rounded shadow overflow-hidden flex-shrink-0 mr-4 relative">
                  {song.coverArt && ctrl && (
                    <CachedImage id={song.coverArt} url={ctrl.getCoverArtUrl(song.coverArt)} alt={song.title} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <FiPlay className="text-white fill-white" />
                  </div>
                </div>
                <div className="flex-1 truncate">
                  <div className="text-white font-medium truncate">{song.title}</div>
                  <div className="text-zinc-400 text-sm truncate">{song.artist}</div>
                </div>
                <div className="text-sm font-medium text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full hidden sm:block truncate max-w-[120px]">
                  {song.album}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Songs */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white px-2 mb-6 tracking-tight">
          Your Top Songs
        </h2>
        <div className="space-y-2 px-2">
          {history.getTopSongs(10).map((song, index) => (
            <div key={`top-${song.id}`} onClick={() => playSongList([song.id])} className="flex items-center p-3 hover:bg-zinc-800/50 rounded-xl cursor-pointer transition-colors group">
              <div className={`w-8 text-center font-bold mr-2 ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-zinc-300' : index === 2 ? 'text-amber-600' : 'text-zinc-600'}`}>
                #{index + 1}
              </div>
              <div className="w-12 h-12 bg-zinc-800 rounded shadow overflow-hidden flex-shrink-0 mr-4 relative">
                {song.coverArt && (
                  <CachedImage 
                    id={song.coverArt} 
                    url={song.coverArt.startsWith('http') ? song.coverArt : (ctrl ? ctrl.getCoverArtUrl(song.coverArt) : '')} 
                    alt={song.title} 
                    className="w-full h-full object-cover" 
                  />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <FiPlay className="text-white fill-white" />
                </div>
              </div>
              <div className="flex-1 truncate">
                <div className="text-white font-medium truncate">{song.title}</div>
                <div className="text-zinc-400 text-sm truncate">{song.artist}</div>
              </div>
              <div className="text-sm font-medium text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full">
                {song.count} plays
              </div>
            </div>
          ))}
          {history.getTopSongs(10).length === 0 && (
             <div className="text-zinc-500 py-4 px-2">Play some songs to see your history here!</div>
          )}
        </div>
      </div>

      {/* Browse by Year */}
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-white px-2 mb-6 tracking-tight">
          Browse by Year
        </h2>
        <div ref={yearBtnScrollRef} className="flex space-x-2 overflow-x-auto scrollbar-thin pb-4 px-2 mb-4 snap-x">
          {years.map(y => (
            <button 
              key={y} 
              onClick={() => setSelectedYear(y)}
              className={`px-5 py-2 rounded-full font-bold text-sm whitespace-nowrap transition-colors snap-start ${selectedYear === y ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
            >
              {y}
            </button>
          ))}
        </div>
        <div ref={yearAlbumsScrollRef} className="flex space-x-4 overflow-x-auto scrollbar-thin pb-4 px-2 snap-x">
          {(yearAlbumsData?.albumList2?.album || []).map((album: any) => (
            <div key={`yr-${album.id}`} className="w-36 flex-shrink-0 snap-start group cursor-pointer" onClick={() => handleOpenAlbum(album.id, album.coverArt)}>
              <div className="aspect-square bg-zinc-800 rounded-xl mb-3 relative overflow-hidden shadow-md">
                {album.coverArt && ctrl && <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />}
              </div>
              <div className="font-bold text-white text-sm truncate">{album.name || album.title}</div>
              <div className="text-xs text-zinc-400 truncate mt-1">{album.artist}</div>
            </div>
          ))}
          {(!yearAlbumsData?.albumList2?.album || yearAlbumsData.albumList2.album.length === 0) && (
             <div className="text-zinc-500 py-8 px-2">No albums found for {selectedYear}</div>
          )}
        </div>
      </div>

      {/* Starred */}
      <ScrollRow title="Starred">
        {((starredData?.starred2?.album) || []).map((album: any) => (
          <div key={`star-${album.id}`} className="w-40 flex-shrink-0 snap-start group cursor-pointer" onClick={() => handleOpenAlbum(album.id, album.coverArt)}>
            <div className="aspect-square bg-zinc-800 rounded-xl mb-3 relative overflow-hidden shadow-md">
              {album.coverArt && ctrl && <CachedImage id={album.coverArt} url={ctrl.getCoverArtUrl(album.coverArt)} alt={album.title} className="w-full h-full object-cover" />}
            </div>
            <div className="font-bold text-white text-sm truncate">{album.name || album.title}</div>
            <div className="text-xs text-zinc-400 truncate mt-1">{album.artist}</div>
          </div>
        ))}
        {(!starredData?.starred2?.album || starredData.starred2.album.length === 0) && (
           <div className="text-zinc-500 py-8 px-2 w-full">You haven't starred any albums yet.</div>
        )}
      </ScrollRow>

    </div>
  );
};
