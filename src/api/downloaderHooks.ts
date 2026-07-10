import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { downloaderApi } from './downloader';

// Polling interval for the queue, as requested by user (10s)
const QUEUE_POLL_INTERVAL = 10000;

export const useGetDownloaderQueue = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['downloader', 'queue'],
    queryFn: async () => {
      try {
        return await downloaderApi.getQueue();
      } catch (error) {
        console.error("Failed to fetch downloader queue:", error);
        return [];
      }
    },
    refetchInterval: QUEUE_POLL_INTERVAL,
    enabled,
  });
};

export const useGetRecentSuccesses = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ['downloader', 'recent-successes'],
    queryFn: async () => {
      try {
        return await downloaderApi.getRecentSuccesses();
      } catch (error) {
        console.error("Failed to fetch recent successes:", error);
        return [];
      }
    },
    refetchInterval: QUEUE_POLL_INTERVAL,
    enabled,
  });
};

export const useGetDownloaderStatus = (jobId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['downloader', 'status', jobId],
    queryFn: async () => {
      return downloaderApi.getStatus(jobId);
    },
    refetchInterval: 5000,
    enabled: !!jobId && enabled,
  });
};

export const useDownloadMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => downloaderApi.download(url),
    onSuccess: () => {
      // Invalidate the queue to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ['downloader', 'queue'] });
    },
  });
};

export const useResumeWorkerMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => downloaderApi.resumeWorker(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['downloader', 'queue'] });
    },
  });
};
