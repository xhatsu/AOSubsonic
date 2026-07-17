import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiMusic, FiSearch, FiRefreshCw, FiAlertCircle, FiRepeat } from 'react-icons/fi';
import { downloaderApi } from '../api/downloader';
import type { AppleMusicSearchResult } from '../api/downloader';
import { useAuthStore } from '../store/auth.store';
import { SubsonicController } from '../api/subsonic';

interface AppleMusicSearchModalProps {
  isOpen: boolean;
  youtubeUrl?: string;
  initialTrack?: string;
  initialArtist?: string;
  onClose: () => void;
  onDownloadSuccess: (message: string) => void;
}

export const AppleMusicSearchModal: React.FC<AppleMusicSearchModalProps> = ({ 
  isOpen, 
  youtubeUrl, 
  initialTrack, 
  initialArtist, 
  onClose, 
  onDownloadSuccess 
}) => {
  const { config } = useAuthStore();
  const ctrl = React.useMemo(() => config ? new SubsonicController(config) : null, [config]);
  
  const [phase, setPhase] = useState<'loading' | 'results' | 'not-found' | 'error' | 'downloading'>('loading');
  const [editTrack, setEditTrack] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [rawTitle, setRawTitle] = useState('');
  const [existingLibraryIds, setExistingLibraryIds] = useState<string[]>([]);
  const [results, setResults] = useState<AppleMusicSearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState('');

  const formatDuration = (ms: number) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getFlag = (storefront: string) => {
    switch (storefront?.toLowerCase()) {
      case 'vn': return '🇻🇳 vn';
      case 'us': return '🇺🇸 us';
      case 'gb': return '🇬🇧 gb';
      case 'jp': return '🇯🇵 jp';
      case 'kr': return '🇰🇷 kr';
      default: return storefront;
    }
  };

  const executeSearch = async (track: string, artist: string) => {
    setPhase('loading');
    try {
      const apiResults = await downloaderApi.searchAppleMusic(track, artist, 5);
      if (apiResults && apiResults.length > 0) {
        setResults(apiResults);
        setSelectedIndex(0);
        setPhase('results');
        
        if (ctrl && apiResults.length > 0) {
          const checkPromises = apiResults.map(async (r) => {
            try {
              const res = await ctrl.search3(`${r.track_name} ${r.artist_name}`, 0, 0, 5);
              const songs = res?.searchResult3?.song || [];
              const exists = songs.some((s: any) => 
                s.title.toLowerCase().includes(r.track_name.toLowerCase()) || 
                r.track_name.toLowerCase().includes(s.title.toLowerCase())
              );
              if (exists) return r.song_id;
            } catch (e) {
              console.error('Subsonic search error:', e);
            }
            return null;
          });
          
          Promise.all(checkPromises).then(results => {
            const existingIds = results.filter(Boolean) as string[];
            setExistingLibraryIds(existingIds);
          });
        }
      } else {
        setPhase('not-found');
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Failed to search Apple Music");
      setPhase('error');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setPhase('loading');
      setEditTrack('');
      setEditArtist('');
      setRawTitle('');
      setResults([]);
      setExistingLibraryIds([]);
      setSelectedIndex(0);
      setErrorMsg('');
      return;
    }

    const initSearch = async () => {
      if (youtubeUrl) {
        setPhase('loading');
        try {
          const parsed = await downloaderApi.fetchYouTubeMeta(youtubeUrl);
          setEditTrack(parsed.track);
          setEditArtist(parsed.artist);
          setRawTitle(parsed.rawTitle);
          await executeSearch(parsed.track, parsed.artist);
        } catch (e: any) {
          console.error(e);
          setErrorMsg(e.message || "Failed to process YouTube link");
          setPhase('error');
        }
      } else {
        // Manual search
        const track = initialTrack || '';
        const artist = initialArtist || '';
        setEditTrack(track);
        setEditArtist(artist);
        setRawTitle('');
        if (track || artist) {
          await executeSearch(track, artist);
        } else {
          setPhase('not-found');
        }
      }
    };

    initSearch();
  }, [isOpen, youtubeUrl, initialTrack, initialArtist]);

  const handleResearch = () => {
    if (!editTrack.trim() && !editArtist.trim()) return;
    executeSearch(editTrack, editArtist);
  };

  const handleDownload = async () => {
    if (selectedIndex < 0 || selectedIndex >= results.length) return;
    
    setPhase('downloading');
    const selected = results[selectedIndex];
    
    try {
      const response = await downloaderApi.download(selected.url);
      if (response && (response.error || response.success === false || response.status === 'error')) {
        throw new Error(response.error || response.message || 'Failed to start download.');
      }
      onDownloadSuccess(response?.message || 'Successfully added to queue!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to start download.');
      setPhase('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div 
        className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col relative overflow-hidden max-h-[calc(100vh-160px)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
        
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center relative z-10 shrink-0">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FiSearch className="text-primary" /> Apple Music Lookup
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row overflow-hidden relative z-10 flex-1 min-h-[300px]">
          {/* Left Column: Search Fields */}
          <div className="p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-zinc-800 bg-black/20 flex flex-col space-y-6 overflow-y-auto shrink-0">
            {rawTitle && (
              <div className="text-sm text-zinc-400">
                Parsed from YouTube:<br/><span className="text-white italic mt-1 block">"{rawTitle}"</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Song Name</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-zinc-700 text-white p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={editTrack}
                  onChange={(e) => setEditTrack(e.target.value)}
                  disabled={phase === 'loading' || phase === 'downloading'}
                />
              </div>
              
              <div className="flex justify-center -my-2 relative z-10">
                <button 
                  type="button"
                  onClick={() => {
                    const temp = editTrack;
                    setEditTrack(editArtist);
                    setEditArtist(temp);
                  }}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white p-2 rounded-full border border-zinc-700 transition-colors shadow-sm"
                  title="Swap Song and Artist"
                  disabled={phase === 'loading' || phase === 'downloading'}
                >
                  <FiRepeat size={14} className="rotate-90" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Artist Name</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-zinc-700 text-white p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  disabled={phase === 'loading' || phase === 'downloading'}
                />
              </div>
              <button 
                onClick={handleResearch}
                disabled={phase === 'loading' || phase === 'downloading' || (!editTrack && !editArtist)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
              >
                <FiRefreshCw className={phase === 'loading' ? 'animate-spin' : ''} />
                Re-search
              </button>

              <div className="mt-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <p className="text-[11px] text-zinc-400 leading-relaxed text-center">
                  <span className="text-blue-400 font-bold mb-1 block">Did you know?</span>
                  Global music typically uses <strong className="text-zinc-300">Artist - Song</strong>, while VN music often uses <strong className="text-zinc-300">Song - Artist</strong>. Use the swap button above if the YouTube parser gets confused!
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="p-6 md:w-2/3 overflow-y-auto flex flex-col">
            {phase === 'loading' && (
              <div className="flex flex-col items-center justify-center flex-1 text-zinc-400 space-y-4 min-h-[200px]">
                <FiRefreshCw className="animate-spin text-4xl text-primary" />
                <p>Searching Apple Music...</p>
              </div>
            )}

            {phase === 'not-found' && (
              <div className="flex flex-col items-center justify-center flex-1 text-yellow-500 space-y-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-6 text-center min-h-[200px]">
                <FiAlertCircle className="text-4xl" />
                <p className="font-medium">No matches found in Apple Music.</p>
                <p className="text-sm text-yellow-500/80">Try modifying the search terms and re-search.</p>
              </div>
            )}

            {phase === 'error' && (
              <div className="flex flex-col items-center justify-center flex-1 text-red-500 space-y-3 bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center min-h-[200px]">
                <FiAlertCircle className="text-4xl" />
                <p className="font-medium">An error occurred</p>
                <p className="text-sm text-red-500/80">{errorMsg}</p>
              </div>
            )}

            {phase === 'results' && results.length > 0 && (
              <div className="space-y-3 flex flex-col h-full">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-2 shrink-0">
                  <FiMusic className="text-primary" /> Select Match ({results.length} found)
                </h3>
                
                <div className="space-y-1.5 overflow-y-auto pr-2 scrollbar-thin flex-1 max-h-[40vh]">
                  {results.map((r, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedIndex(i)}
                      className={`flex items-center p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedIndex === i 
                          ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.2)]' 
                          : 'bg-zinc-800/50 border-transparent hover:bg-zinc-800'
                      }`}
                    >
                      <div className="mr-3 flex-shrink-0">
                        <input 
                          type="radio" 
                          checked={selectedIndex === i} 
                          readOnly 
                          className="accent-primary w-4 h-4"
                        />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="font-bold text-sm text-white truncate leading-tight flex items-center gap-2">
                          {r.track_name || 'Unknown Track'}
                          {existingLibraryIds.includes(r.song_id) && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded text-[9px] font-bold tracking-widest uppercase shrink-0">
                              <FiCheck size={10} /> In Library
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-white truncate mt-0.5 leading-tight">{r.artist_name || 'Unknown Artist'}</div>
                        <div className="text-[10px] text-white flex flex-wrap items-center gap-1.5 mt-1">
                          {r.album_name && (
                            <>
                              <span className="bg-zinc-800 px-1.5 py-0.5 rounded leading-tight">
                                {r.album_name}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          <span>{formatDuration(r.duration_ms)}</span>
                          <span>•</span>
                          <span className="bg-zinc-800 px-1.5 py-0.5 rounded font-mono">
                            {getFlag(r.storefront)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-black/20 flex justify-end gap-3 relative z-10 shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            disabled={phase === 'loading' || phase === 'downloading'}
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={phase !== 'results' || results.length === 0}
            className="px-8 py-2.5 bg-primary hover:bg-purple-600 text-white rounded-full font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
          >
            {phase === 'downloading' ? (
              <span className="animate-pulse flex items-center gap-2"><FiRefreshCw className="animate-spin" /> Downloading...</span>
            ) : (
              <>
                <FiCheck /> Download Selection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
