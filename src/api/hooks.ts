import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SubsonicController } from './subsonic';
import { useAuthStore } from '../store/auth.store';

// Helper to get controller instance
const useController = () => {
  const config = useAuthStore((state) => state.config);
  if (!config) return null;
  return new SubsonicController(config);
};

export const useGetArtists = () => {
  const controller = useController();
  return useQuery({
    queryKey: ['artists', controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getArtists();
    },
    enabled: !!controller,
  });
};

export const useGetAlbum = (id: string) => {
  const controller = useController();
  return useQuery({
    queryKey: ['album', id],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getAlbum(id);
    },
    enabled: !!controller && !!id,
  });
};

export const useGetSong = (id: string) => {
  const controller = useController();
  return useQuery({
    queryKey: ['song', id],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getSong(id);
    },
    enabled: !!controller && !!id,
  });
};

export const useGetArtist = (id: string) => {
  const controller = useController();
  return useQuery({
    queryKey: ['artist', id],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getArtist(id);
    },
    enabled: !!controller && !!id,
  });
};

export const useGetArtistInfo2 = (id: string) => {
  const controller = useController();
  return useQuery({
    queryKey: ['artistInfo2', id],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getArtistInfo2(id);
    },
    enabled: !!controller && !!id,
  });
};

export const useGetAlbumList = (type: string = 'newest', size: number = 40, offset: number = 0) => {
  const controller = useController();
  return useQuery({
    queryKey: ['albumList', type, size, offset, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getAlbumList(type, size, offset);
    },
    placeholderData: keepPreviousData,
    enabled: !!controller,
  });
};

export const useGetRandomSongsQuery = (size: number = 40, offset: number = 0) => {
  const controller = useController();
  return useQuery({
    queryKey: ['randomSongsQuery', size, offset, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getRandomSongs(size, offset);
    },
    placeholderData: keepPreviousData,
    enabled: !!controller,
  });
};

export const useGetGenres = () => {
  const controller = useController();
  return useQuery({
    queryKey: ['genres', controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getGenres();
    },
    enabled: !!controller,
  });
};

export const useGetAlbumList2 = (type: string = 'newest', size: number = 40, offset: number = 0, extra?: Record<string, string>) => {
  const controller = useController();
  return useQuery({
    queryKey: ['albumList2', type, size, offset, extra, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getAlbumList2(type, size, offset, extra);
    },
    placeholderData: keepPreviousData,
    enabled: !!controller && (type !== 'byGenre' || !!extra?.genre),
  });
};

export const useSearchQuery = (query: string, artistCount = 10, albumCount = 10, songCount = 20) => {
  const controller = useController();
  return useQuery({
    queryKey: ['search3', query, artistCount, albumCount, songCount, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.search3(query, artistCount, albumCount, songCount);
    },
    enabled: !!controller && !!query && query.length > 0,
  });
};

export const useGetPlaylists = () => {
  const controller = useController();
  return useQuery({
    queryKey: ['playlists', controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getPlaylists();
    },
    enabled: !!controller,
  });
};

export const useGetPlaylist = (id: string | null) => {
  const controller = useController();
  return useQuery({
    queryKey: ['playlist', id],
    queryFn: async () => {
      if (!controller || !id) throw new Error('Not authenticated or no ID');
      return controller.getPlaylist(id);
    },
    enabled: !!controller && !!id,
  });
};

export const useGetFrequentAlbums = (size: number = 20) => {
  const controller = useController();
  return useQuery({
    queryKey: ['frequentAlbums', size, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getAlbumList('frequent', size);
    },
    enabled: !!controller,
  });
};

export const useGetRecentAlbums = (size: number = 20) => {
  const controller = useController();
  return useQuery({
    queryKey: ['recentAlbums', size, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getAlbumList('recent', size);
    },
    enabled: !!controller,
  });
};

export const useGetAlbumsByYear = (fromYear: number, toYear: number, size: number = 50) => {
  const controller = useController();
  return useQuery({
    queryKey: ['albumsByYear', fromYear, toYear, size, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getAlbumList2('byYear', size, 0, { fromYear: fromYear.toString(), toYear: toYear.toString() });
    },
    enabled: !!controller && !!fromYear && !!toYear,
  });
};

export const useGetStarred2 = () => {
  const controller = useController();
  return useQuery({
    queryKey: ['starred2', controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getStarred2();
    },
    enabled: !!controller,
  });
};
