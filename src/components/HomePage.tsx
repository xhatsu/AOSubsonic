import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { useHistoryStore } from '../store/history.store';
import { usePlayerStore, type QueueSong } from '../store/player.store';
import { 
  useGetFrequentAlbums, 
  useGetRecentAlbums, 
  useGetAlbumsByYear, 
  useGetStarred2 
} from '../api/hooks';
import { SubsonicController } from '../api/subsonic';
import { CachedImage } from './CachedImage';
import { FiPlay, FiActivity, FiCpu, FiCopy, FiCheck } from 'react-icons/fi';
import { LLMService, type LLMResponse } from '../services/llm.service';
import { MoodTrackList } from './MoodTrackList';
import { AIPlaylistCard } from './AIPlaylistCard';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';
import { Vibrant } from 'node-vibrant/browser';

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
  const { setView, setSelectedAlbumId, setSelectedAlbumCover, llmProvider, llmApiKey } = useUIStore();
  const history = useHistoryStore();
  const { setQueue, play } = usePlayerStore();
  
  const aiScrollRef = useHorizontalScroll<HTMLDivElement>();
  const yearBtnScrollRef = useHorizontalScroll<HTMLDivElement>();
  const yearAlbumsScrollRef = useHorizontalScroll<HTMLDivElement>();

  // LLM State
  const [llmResponse, setLlmResponse] = useState<LLMResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualResponse, setManualResponse] = useState('');
  const [copied, setCopied] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  // Spotlight State
  const [spotlightColor, setSpotlightColor] = useState<string | null>(null);
  const [spotlightIndex, setSpotlightIndex] = useState(0);

  // API Data
  const { data: frequentData } = useGetFrequentAlbums(15);
  const { data: recentData } = useGetRecentAlbums(15);
  const { data: starredData } = useGetStarred2();
  
  const topAlbums = frequentData?.albumList?.album?.slice(0, 5) || recentData?.albumList?.album?.slice(0, 5) || [];
  const topAlbum = topAlbums[spotlightIndex] || topAlbums[0];

  useEffect(() => {
    if (topAlbums.length === 0) return;
    const interval = setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % topAlbums.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [topAlbums.length]);

  useEffect(() => {
    if (topAlbum?.coverArt && ctrl) {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = ctrl.getCoverArtUrl(topAlbum.coverArt);
      img.onload = () => {
        Vibrant.from(img).getPalette().then(palette => {
          // Extract all valid swatches and sort by population to find the true dominant color
          const swatches = Object.values(palette).filter(s => s !== null);
          if (swatches.length > 0) {
            swatches.sort((a, b) => b!.population - a!.population);
            setSpotlightColor(swatches[0]!.hex);
          } else {
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

  useEffect(() => {
    const cached = localStorage.getItem('aosubsonic-llm-cache');
    if (cached) {
      try {
        setLlmResponse(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached LLM response', e);
      }
    }
  }, []);

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

  const handleGenerateLLM = async () => {
    if (!ctrl) return;
    setIsGenerating(true);
    try {
      const prompt = await LLMService.generatePromptContext(ctrl);
      
      if (llmProvider === 'manual' || !llmApiKey) {
        setManualPrompt(prompt + "\\n\\n" + LLMService.getSystemPrompt());
        setShowManualInput(true);
        setIsGenerating(false);
        return;
      }

      const fullPrompt = prompt + "\\n\\n" + LLMService.getSystemPrompt();
      let response: LLMResponse;
      
      if (llmProvider === 'gemini') {
        response = await LLMService.fetchGemini(llmApiKey, fullPrompt);
      } else {
        response = await LLMService.fetchOpenAI(llmApiKey, fullPrompt);
      }
      
      setLlmResponse(response);
      localStorage.setItem('aosubsonic-llm-cache', JSON.stringify(response));
    } catch (e) {
      console.error(e);
      alert("Failed to generate AI recommendations.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualSubmit = () => {
    try {
      const parsed = JSON.parse(manualResponse) as LLMResponse;
      if (!parsed.playlists && !parsed.moods) throw new Error("Invalid format");
      setLlmResponse(parsed);
      localStorage.setItem('aosubsonic-llm-cache', JSON.stringify(parsed));
      setShowManualInput(false);
    } catch (e) {
      alert("Invalid JSON format. Please ensure you copied the raw JSON correctly.");
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(manualPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      {/* For You / LLM Recommendations */}
      <div className="mb-12 relative p-6 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/50 shadow-xl overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-6 relative z-10">
          <h2 className="text-3xl font-bold text-white tracking-tight">
            For You
          </h2>
          <button onClick={handleGenerateLLM} disabled={isGenerating} className="text-sm bg-primary/20 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-full font-bold transition-colors">
            {isGenerating ? 'Generating...' : llmResponse ? 'Refresh AI' : 'Generate with AI'}
          </button>
        </div>

        {showManualInput && (
          <div className="bg-zinc-900 rounded-xl p-4 mb-6 border border-zinc-700 relative z-10">
            <h3 className="text-lg font-bold text-white mb-2">Manual AI Mode</h3>
            <p className="text-sm text-zinc-400 mb-4">Copy the prompt below, paste it into ChatGPT, and paste the JSON response back here.</p>
            
            <div className="flex space-x-4">
              <button onClick={copyToClipboard} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-lg flex items-center justify-center font-bold transition-colors">
                {copied ? <FiCheck className="mr-2 text-green-400" /> : <FiCopy className="mr-2" />} 
                {copied ? 'Copied!' : 'Copy Prompt'}
              </button>
            </div>
            
            <textarea
              className="w-full mt-4 h-32 bg-zinc-950 text-zinc-300 border border-zinc-800 p-3 rounded-lg text-sm font-mono focus:outline-none focus:border-primary"
              placeholder="Paste JSON response here..."
              value={manualResponse}
              onChange={(e) => setManualResponse(e.target.value)}
            />
            <button onClick={handleManualSubmit} className="mt-4 w-full bg-primary hover:bg-purple-600 text-white p-3 rounded-lg font-bold transition-colors">
              Apply Recommendations
            </button>
          </div>
        )}

        {!llmResponse && !showManualInput && !isGenerating && (
          <div className="text-center py-12 relative z-10">
            <FiCpu className="text-6xl text-zinc-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">AI Recommendations</h3>
            <p className="text-zinc-400 max-w-md mx-auto">Set up an API key in Settings or use Manual Mode to get deeply personalized playlists based on your listening history.</p>
          </div>
        )}

        {isGenerating && (
          <div className="flex space-x-4 overflow-hidden relative z-10 py-2">
            {[1, 2, 3].map(i => (
              <div key={`skel-${i}`} className="w-64 flex-shrink-0 bg-zinc-800/40 rounded-xl p-4 animate-pulse border border-zinc-700/30">
                <div className="w-full aspect-square bg-zinc-700/50 rounded-lg mb-4"></div>
                <div className="h-4 bg-zinc-700/50 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-zinc-700/50 rounded w-full mb-1"></div>
                <div className="h-3 bg-zinc-700/50 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        )}

        {llmResponse?.playlists && (
          <div ref={aiScrollRef} className="flex space-x-4 overflow-x-auto scrollbar-thin pb-4 snap-x relative z-10">
            {llmResponse.playlists.map((pl, i) => (
              <AIPlaylistCard 
                key={`ai-pl-${i}`}
                title={pl.name}
                description={pl.description}
                songIds={pl.songIds}
                onClick={() => playSongList(pl.songIds)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Moods Section */}
      {llmResponse?.moods && (
        <div className="mb-12">
          {Object.entries(llmResponse.moods).map(([moodKey, moodData]) => {
            if (!moodData || !moodData.songIds || moodData.songIds.length === 0) return null;
            const title = moodKey.charAt(0).toUpperCase() + moodKey.slice(1) + " Mood";
            return (
              <MoodTrackList 
                key={moodKey}
                title={title}
                description={moodData.description}
                songIds={moodData.songIds}
                onPlayAll={() => playSongList(moodData.songIds)}
              />
            );
          })}
        </div>
      )}

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
                  song.coverArt.startsWith('http') 
                    ? <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                    : ctrl && <CachedImage id={song.coverArt} url={ctrl.getCoverArtUrl(song.coverArt)} alt={song.title} className="w-full h-full object-cover" />
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
