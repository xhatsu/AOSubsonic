import React, { useState } from 'react';
import { FiX, FiCopy, FiDownload, FiCheck, FiMusic } from 'react-icons/fi';
import { SubsonicController } from '../api/subsonic';
import { useQueryClient } from '@tanstack/react-query';

interface AiPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  ctrl: SubsonicController | null;
}

export const AiPlaylistModal: React.FC<AiPlaylistModalProps> = ({ isOpen, onClose, ctrl }) => {
  const [phase, setPhase] = useState<'prompt' | 'import'>('prompt');

  // Prompt Generation State
  const [playlistIdea, setPlaylistIdea] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [copied, setCopied] = useState(false);

  // Import State
  const [jsonResponse, setJsonResponse] = useState('');
  const [playlistName, setPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const fetchSongs = async () => {
    if (!ctrl) return [];

    const allSongs = new Map();
    const maxSongs = 1000;

    // Helper to fetch songs from a list of albums
    const fetchAlbumsToSongs = async (albumList: any[]) => {
      for (let i = 0; i < albumList.length; i += 10) {
        const chunk = albumList.slice(i, i + 10);
        const results = await Promise.all(
          chunk.map((a: any) => ctrl.getAlbum(a.id).catch(() => null))
        );

        for (const res of results) {
          const songs = res?.album?.song;
          if (songs) {
            const songArr = Array.isArray(songs) ? songs : [songs];
            for (const s of songArr) {
              allSongs.set(s.id, s);
              if (allSongs.size >= maxSongs) break;
            }
          }
        }
        if (allSongs.size >= maxSongs) break;
      }
    };

    // 1. Fetch frequent albums
    try {
      const data = await ctrl.getAlbumList('frequent', 500, 0);
      let albumList = data.albumList?.album || [];
      if (!Array.isArray(albumList)) albumList = [albumList];
      await fetchAlbumsToSongs(albumList);
    } catch (e) {
      console.error("Failed to fetch frequent albums", e);
    }

    // 2. If we still need more songs, fetch newest albums (catches unplayed albums)
    if (allSongs.size < maxSongs) {
      try {
        const data = await ctrl.getAlbumList('newest', 500, 0);
        let albumList = data.albumList?.album || [];
        if (!Array.isArray(albumList)) albumList = [albumList];
        await fetchAlbumsToSongs(albumList);
      } catch (e) {
        console.error("Failed to fetch newest albums", e);
      }
    }

    // If we have less than maxSongs, try grabbing random songs to fill the gap
    // 3. Last resort: random songs
    if (allSongs.size < maxSongs) {
      try {
        const randomData = await ctrl.getRandomSongs(500);
        let randomSongs = randomData.randomSongs?.song || [];
        if (!Array.isArray(randomSongs)) randomSongs = [randomSongs];
        for (const s of randomSongs) {
          allSongs.set(s.id, s);
          if (allSongs.size >= maxSongs) break;
        }
      } catch (e) {
        console.error("Failed to fetch additional random songs", e);
      }
    }

    return Array.from(allSongs.values());
  };

  const generatePrompt = async () => {
    if (!playlistIdea.trim()) return alert("Please enter a playlist idea.");
    setIsGenerating(true);

    try {
      const songs = await fetchSongs();

      if (songs.length === 0) {
        alert("No songs found in your library.");
        setIsGenerating(false);
        return;
      }

      // Build the table
      let table = `| ID | Title | Artist | Album | Genre | Duration |\n`;
      table += `|---|---|---|---|---|---|\n`;

      for (const s of songs) {
        const min = Math.floor(s.duration / 60);
        const sec = (s.duration % 60).toString().padStart(2, '0');
        const duration = `${min}:${sec}`;
        const title = (s.title || '').replace(/\|/g, '');
        const artist = (s.artist || '').replace(/\|/g, '');
        const album = (s.album || '').replace(/\|/g, '');
        const genre = (s.genre || '').replace(/\|/g, '');

        table += `| ${s.id} | ${title} | ${artist} | ${album} | ${genre} | ${duration} |\n`;
      }

      const promptTemplate = `You are a music playlist curator. I will give you my music library and a playlist request. Pick songs that fit the request.

## My Request
${playlistIdea}

## Rules
- Pick around 100-200 songs from the list below if possible. Focus heavily on the vibe, mood, and tempo (e.g. up beat vs down beat) requested. If there are fewer songs that truly fit the vibe, that's fine—accuracy is more important than numbers.
- Return ONLY a JSON array of the song IDs you picked, nothing else (no markdown formatting, no explanations).
- Example output: ["id1", "id2", "id3"]

## My Library (${songs.length} songs)
${table}`;

      setGeneratedPrompt(promptTemplate);
      setPhase('import');
    } catch (e) {
      console.error(e);
      alert("Failed to generate prompt. See console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedPrompt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'playlist-prompt.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreatePlaylist = async () => {
    if (!jsonResponse.trim()) return alert("Please paste the LLM response.");
    if (!playlistName.trim()) return alert("Please enter a playlist name.");
    if (!ctrl) return;

    setIsCreating(true);
    try {
      // Parse JSON
      // sometimes LLMs wrap it in markdown code blocks like ```json ... ```
      let cleanedJson = jsonResponse.trim();
      if (cleanedJson.startsWith('\`\`\`')) {
        const lines = cleanedJson.split('\n');
        lines.shift();
        if (lines[lines.length - 1].startsWith('\`\`\`')) {
          lines.pop();
        }
        cleanedJson = lines.join('\n');
      }

      const songIds = JSON.parse(cleanedJson);

      if (!Array.isArray(songIds)) {
        throw new Error("Response is not a JSON array.");
      }
      if (songIds.length === 0) {
        throw new Error("JSON array is empty.");
      }

      await ctrl.createPlaylist(playlistName, songIds);
      queryClient.invalidateQueries({ queryKey: ['playlists'] });

      alert(`Successfully created playlist "${playlistName}" with ${songIds.length} songs!`);
      onClose();
    } catch (e: any) {
      console.error(e);
      alert(`Failed to parse response or create playlist. Ensure the response is a pure JSON array. Error: ${e.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-2xl font-bold text-white flex items-center">
            <FiMusic className="mr-3 text-primary" /> AI Playlist Creator
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <FiX className="text-2xl" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {phase === 'prompt' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  What kind of playlist do you want?
                </label>
                <textarea
                  value={playlistIdea}
                  onChange={(e) => setPlaylistIdea(e.target.value)}
                  placeholder="e.g. A mix of upbeat rock and indie pop for a road trip..."
                  className="w-full h-32 bg-zinc-800/50 border border-zinc-700 text-white rounded-xl p-4 focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800 text-sm text-zinc-400">
                <p><strong>How this works:</strong> We'll gather your most-listened songs (up to 1000) and build a prompt. You'll paste that prompt into ChatGPT, Claude, or any AI model. Then you'll paste its response back here to instantly create your playlist.</p>
              </div>

              <button
                onClick={generatePrompt}
                disabled={isGenerating || !playlistIdea.trim()}
                className="w-full bg-primary hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center"
              >
                {isGenerating ? 'Fetching Songs & Building Prompt...' : 'Generate Prompt'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Export */}
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
                <h3 className="text-lg font-bold text-white mb-3">Step 1: Get Your Prompt</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Copy this prompt and paste it into any AI chatbot (ChatGPT, Gemini, Claude). It contains your playlist idea and your library data.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleCopy}
                    className="flex-1 flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-lg border border-zinc-600 transition-colors"
                  >
                    {copied ? <FiCheck className="text-green-400" /> : <FiCopy />}
                    <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center space-x-2 bg-zinc-800 hover:bg-zinc-700 text-white py-2.5 rounded-lg border border-zinc-600 transition-colors"
                  >
                    <FiDownload />
                    <span>Download .txt</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Import */}
              <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-xl p-5">
                <h3 className="text-lg font-bold text-white mb-3">Step 2: Create Playlist</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Paste the JSON array response from the AI here.
                </p>

                <label className="block text-sm font-medium text-zinc-300 mb-2">Playlist Name</label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  placeholder="e.g. AI Road Trip Mix"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg p-3 mb-4 focus:outline-none focus:border-primary transition-colors"
                />

                <label className="block text-sm font-medium text-zinc-300 mb-2">AI Response (JSON)</label>
                <textarea
                  value={jsonResponse}
                  onChange={(e) => setJsonResponse(e.target.value)}
                  placeholder='["id1", "id2", ...]'
                  className="w-full h-32 bg-zinc-800 border border-zinc-700 text-white rounded-lg p-3 focus:outline-none focus:border-primary transition-colors font-mono text-sm resize-none mb-4"
                />

                <button
                  onClick={handleCreatePlaylist}
                  disabled={isCreating || !jsonResponse.trim() || !playlistName.trim()}
                  className="w-full bg-primary hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center"
                >
                  {isCreating ? 'Creating Playlist...' : 'Create Playlist'}
                </button>
              </div>

              <div className="text-center">
                <button
                  onClick={() => setPhase('prompt')}
                  className="text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
