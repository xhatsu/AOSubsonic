import { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { FiMusic, FiList, FiSettings, FiLogOut, FiChevronDown, FiChevronRight, FiUser, FiDisc, FiRadio, FiGrid } from 'react-icons/fi';

const THEMES = [
  { name: 'Purple', value: '#aa3bff' },
  { name: 'Pink', value: '#ff3b7c' },
  { name: 'Green', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Orange', value: '#f97316' },
];

export const Sidebar = () => {
  const logout = useAuthStore((state) => state.logout);
  const { themeColor, setThemeColor, view, setView } = useUIStore();
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between h-full text-zinc-300">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white mb-8 tracking-tighter">OS<span className="text-primary">Client</span></h1>
        <nav className="space-y-2">
          <div>
            <button 
              onClick={() => setIsLibraryOpen(!isLibraryOpen)} 
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-zinc-900 text-white transition-colors"
            >
              <div className="flex items-center space-x-3">
                <FiMusic className="text-lg" />
                <span className="font-medium">Library</span>
              </div>
              {isLibraryOpen ? <FiChevronDown /> : <FiChevronRight />}
            </button>
            
            {isLibraryOpen && (
              <div className="mt-2 ml-4 flex flex-col space-y-1 border-l border-zinc-800 pl-3">
                <button 
                  onClick={() => setView('artists')}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${view === 'artists' ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
                >
                  <FiUser className="text-md" />
                  <span>Artists</span>
                </button>
                <button 
                  onClick={() => setView('albums')}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${view === 'albums' ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
                >
                  <FiDisc className="text-md" />
                  <span>Albums</span>
                </button>
                <button 
                  onClick={() => setView('tracks')}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${view === 'tracks' ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
                >
                  <FiRadio className="text-md" />
                  <span>Tracks</span>
                </button>
                <button 
                  onClick={() => setView('genres')}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${view === 'genres' || view === 'genreDetail' ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
                >
                  <FiGrid className="text-md" />
                  <span>Genres</span>
                </button>
              </div>
            )}
          </div>
          <a href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-zinc-900 hover:text-white transition-colors">
            <FiList className="text-lg" />
            <span className="font-medium">Playlists</span>
          </a>
          <button 
            onClick={() => setView('settings')}
            className={`flex items-center space-x-3 px-3 py-2 w-full rounded-lg transition-colors text-left ${view === 'settings' ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
          >
            <FiSettings className="text-lg" />
            <span className="font-medium">Settings</span>
          </button>
        </nav>
      </div>
      <div className="p-6 space-y-6">
        {/* Theme Selector */}
        <div>
          <h3 className="text-xs uppercase font-semibold text-zinc-500 mb-3 tracking-wider px-2">Theme</h3>
          <div className="flex items-center space-x-2 px-2">
            {THEMES.map((theme) => (
              <button
                key={theme.name}
                onClick={() => setThemeColor(theme.value)}
                className={`w-6 h-6 rounded-full transition-transform ${themeColor === theme.value ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-zinc-950' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                style={{ backgroundColor: theme.value }}
                title={theme.name}
              />
            ))}
          </div>
        </div>

        <button 
          onClick={logout}
          className="flex items-center space-x-3 px-3 py-2 w-full rounded-lg hover:bg-zinc-900 hover:text-white transition-colors text-left"
        >
          <FiLogOut className="text-lg" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};
