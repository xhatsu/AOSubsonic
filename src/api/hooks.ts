import { useQuery } from '@tanstack/react-query';
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

export const useGetAlbumList = (type: string = 'newest', size: number = 50) => {
  const controller = useController();
  return useQuery({
    queryKey: ['albumList', type, size, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getAlbumList(type, size);
    },
    enabled: !!controller,
  });
};

export const useGetRandomSongsQuery = (size: number = 50) => {
  const controller = useController();
  return useQuery({
    queryKey: ['randomSongsQuery', size, controller?.['config']?.serverUrl],
    queryFn: async () => {
      if (!controller) throw new Error('Not authenticated');
      return controller.getRandomSongs(size);
    },
    enabled: !!controller,
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
