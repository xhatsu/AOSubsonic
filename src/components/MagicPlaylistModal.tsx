import React, { useState } from 'react';
import { FiX, FiCheck, FiMusic, FiCpu } from 'react-icons/fi';
import { SubsonicController } from '../api/subsonic';
import { useQueryClient } from '@tanstack/react-query';
import { LLMService } from '../services/llm.service';
import { useUIStore } from '../store/ui.store';

interface MagicPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctrl: SubsonicController | null;
}

export const MagicPlaylistModal: React.FC<MagicPlaylistModalProps> = ({ isOpen, onClose, ctrl }) => {
  const [playlistIdea, setPlaylistIdea] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [songCount, setSongCount] = useState(200);
  const [strictness, setStrictness] = useState(0.1);
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleGenerateAndSave = async () => {
    if (!playlistIdea.trim()) return alert("Please enter a vibe or playlist idea.");
    if (!playlistName.trim()) return alert("Please enter a name for the new playlist.");
    if (!ctrl) return;

    setIsGenerating(true);

    try {
      const { llmApiKey } = useUIStore.getState();
      if (!llmApiKey) {
        alert("Please set your OpenRouter API key in AI Settings first!");
        setIsGenerating(false);
        return;
      }
      
      // 1. Get the embedding vector
      const vector = await LLMService.generateEmbedding(playlistIdea, llmApiKey);
      
      // 2. Fetch closest songs mathematically
      const res = await fetch(`/api/radio/prompt?count=${songCount}&strictness=${strictness}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vector })
      });
      
      if (!res.ok) throw new Error("Failed to get songs from the vector search");
      const data = await res.json();
      
      if (!data.songs || data.songs.length === 0) {
        throw new Error("No matching songs found in your database.");
      }

      // 3. Extract IDs and save playlist
      const songIds = data.songs.map((s: any) => s.id);
      await ctrl.createPlaylist(playlistName, songIds);
      
      // Refresh playlist list
      queryClient.invalidateQueries({ queryKey: ['playlists'] });

      alert(`Successfully generated and saved playlist "${playlistName}" with ${songIds.length} songs!`);
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(`Magic Vibe failed: ${e.message || e}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div 
        className="bg-zinc-900 border border-zinc-700/50 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
        
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center relative z-10">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FiCpu className="text-primary" /> Magic Vibe Playlist Builder
          </h2>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-2 hover:bg-zinc-800 rounded-full"
          >
            <FiX size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto relative z-10 flex flex-col space-y-6">
          <div className="bg-white/5 border border-primary/20 rounded-xl p-5 shadow-lg">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <FiMusic className="text-primary" /> Describe Your Vibe
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              Enter any prompt (e.g. "dark synthwave for late night driving") and we will use semantic vector math to instantly find the 200 closest songs in your library.
            </p>
            <textarea
              className="w-full bg-black/40 border border-zinc-700 text-white p-4 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none transition-all placeholder:text-zinc-600"
              rows={3}
              placeholder="e.g. upbeat hyperpop and glitchcore"
              value={playlistIdea}
              onChange={(e) => setPlaylistIdea(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
              Playlist Details
            </h3>
            <input
              type="text"
              className="w-full bg-black/40 border border-zinc-700 text-white p-3 rounded-xl focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all placeholder:text-zinc-600"
              placeholder="Name for your new playlist..."
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              disabled={isGenerating}
            />
          </div>

          <div className="bg-white/5 border border-white/5 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">
              Advanced Settings
            </h3>
            
            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Playlist Size</span>
                <span className="text-white font-bold">{songCount} Songs</span>
              </div>
              <input 
                type="range" 
                min="20" max="300" step="10"
                value={songCount} 
                onChange={(e) => setSongCount(Number(e.target.value))} 
                className="w-full accent-primary" 
                disabled={isGenerating}
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Strictness (Gradient Cutoff)</span>
                <span className="text-white font-bold">{strictness}</span>
              </div>
              <input 
                type="range" 
                min="0.0" max="0.3" step="0.01"
                value={strictness} 
                onChange={(e) => setStrictness(Number(e.target.value))} 
                className="w-full accent-primary" 
                disabled={isGenerating}
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                Lower = Stricter (shorter, high quality). Higher = Lenient (fills to max size).
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-black/20 flex justify-end gap-3 relative z-10">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateAndSave}
            disabled={isGenerating}
            className="px-8 py-2.5 bg-primary hover:bg-purple-600 text-white rounded-full font-bold transition-all shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <span className="animate-pulse">Generating Vector...</span>
            ) : (
              <>
                <FiCheck /> Generate & Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
