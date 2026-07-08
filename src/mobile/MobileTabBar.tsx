import { FiMusic, FiList, FiSearch, FiSettings, FiHome } from 'react-icons/fi';
import { useUIStore } from '../store/ui.store';

export const MobileTabBar = () => {
  const { view, setView } = useUIStore();

  const tabs = [
    { id: 'home', icon: FiHome, label: 'Home' },
    { id: 'albums', icon: FiMusic, label: 'Library' },
    { id: 'playlists', icon: FiList, label: 'Playlists' },
    // Reusing standard views for search
    { id: 'search', icon: FiSearch, label: 'Search' },
    { id: 'settings', icon: FiSettings, label: 'Settings' },
  ];

  const getActiveState = (tabId: string) => {
    if (tabId === 'home') return view === 'home';
    if (tabId === 'albums') return view === 'albums' || view === 'artists' || view === 'tracks' || view === 'genres' || view === 'albumDetail' || view === 'artistDetail' || view === 'genreDetail';
    if (tabId === 'playlists') return view === 'playlists' || view === 'playlistDetail';
    if (tabId === 'search') return view === 'search';
    if (tabId === 'settings') return view === 'settings';
    return false;
  };

  return (
    <div className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around px-4 pb-safe relative z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = getActiveState(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => setView(tab.id as any)}
            className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors touch-target ${
              isActive ? 'text-primary' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Icon className="text-xl" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
