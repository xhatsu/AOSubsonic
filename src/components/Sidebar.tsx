import { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { FiMusic, FiList, FiSettings, FiLogOut, FiChevronDown, FiChevronRight, FiUser, FiDisc, FiRadio, FiGrid, FiHome, FiDownload } from 'react-icons/fi';


export const Sidebar = () => {
  const logout = useAuthStore((state) => state.logout);
  const { view, setView } = useUIStore();
  const [isLibraryOpen, setIsLibraryOpen] = useState(true);

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between h-full text-zinc-300 relative overflow-hidden">
      <div className="p-6 relative z-10">
        <h1 className="text-2xl font-bold text-white mb-8 tracking-tighter">AO<span className="text-primary">Subsonic</span></h1>
        <nav className="space-y-2">
          <button 
            onClick={() => setView('home')}
            className={`flex items-center space-x-3 w-full px-3 py-2 rounded-lg transition-colors text-left mb-2 ${view === 'home' ? 'bg-primary/20 text-white font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
          >
            <FiHome className="text-lg" />
            <span className="font-medium">Home</span>
          </button>
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
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${view === 'artists' ? 'bg-primary/20 text-white font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
                >
                  <FiUser className="text-md" />
                  <span>Artists</span>
                </button>
                <button 
                  onClick={() => setView('albums')}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${view === 'albums' ? 'bg-primary/20 text-white font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
                >
                  <FiDisc className="text-md" />
                  <span>Albums</span>
                </button>
                <button 
                  onClick={() => setView('tracks')}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${view === 'tracks' ? 'bg-primary/20 text-white font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
                >
                  <FiRadio className="text-md" />
                  <span>Tracks</span>
                </button>
                <button 
                  onClick={() => setView('genres')}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors text-sm ${view === 'genres' || view === 'genreDetail' ? 'bg-primary/20 text-white font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
                >
                  <FiGrid className="text-md" />
                  <span>Genres</span>
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={() => setView('playlists')}
            className={`flex items-center space-x-3 px-3 py-2 w-full rounded-lg transition-colors text-left ${view === 'playlists' || view === 'playlistDetail' ? 'bg-primary/20 text-white font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
          >
            <FiList className="text-lg" />
            <span className="font-medium">Playlists</span>
          </button>
          <button 
            onClick={() => setView('downloader')}
            className={`flex items-center space-x-3 px-3 py-2 w-full rounded-lg transition-colors text-left ${view === 'downloader' ? 'bg-primary/20 text-white font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
          >
            <FiDownload className="text-lg" />
            <span className="font-medium">Downloader</span>
          </button>
          <button 
            onClick={() => setView('settings')}
            className={`flex items-center space-x-3 px-3 py-2 w-full rounded-lg transition-colors text-left ${view === 'settings' ? 'bg-primary/20 text-white font-medium' : 'hover:bg-zinc-900 hover:text-white'}`}
          >
            <FiSettings className="text-lg" />
            <span className="font-medium">Settings</span>
          </button>
        </nav>
      </div>
      <div className="p-6 space-y-6 relative z-10">
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
