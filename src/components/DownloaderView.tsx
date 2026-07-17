import React, { useState, useEffect } from 'react';
import { useGetDownloaderQueue, useGetRecentSuccesses, useGetDownloaderStatus, useDownloadMutation } from '../api/downloaderHooks';
import { DownloaderAuth } from './DownloaderAuth';
import { downloaderApi } from '../api/downloader';
import { FiDownload, FiRefreshCw, FiAlertCircle, FiCheckCircle, FiClock, FiActivity, FiSearch } from 'react-icons/fi';
import { AppleMusicSearchModal } from './AppleMusicSearchModal';

const LiveJobItem = ({ initialJob, explicitJobId, defaultStatus, renderItem }: { initialJob?: any, explicitJobId?: string, defaultStatus: string, renderItem: (item: any, i: number, defaultStatus: string) => React.ReactNode }) => {
  const jobId = explicitJobId || (initialJob ? (initialJob.job_id || initialJob.id || initialJob.current_job_id) : '');
  const isValidJobId = typeof jobId === 'string' && jobId.length > 10;

  const { data } = useGetDownloaderStatus(isValidJobId ? jobId : '', !!isValidJobId);

  const displayJob = data || initialJob || { job_id: jobId, title: 'Loading details...' };

  if (!isValidJobId && !initialJob) return null;

  return renderItem(displayJob, 0, data?.status ? data.status : defaultStatus);
};

export const DownloaderView = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!downloaderApi.getToken());
  const [url, setUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'failed' | 'recent'>('active');

  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [pendingYtUrl, setPendingYtUrl] = useState('');
  const [manualTrack, setManualTrack] = useState('');
  const [manualArtist, setManualArtist] = useState('');

  const { data: queueData, isLoading: isLoadingQueue, isFetching: isFetchingQueue, isError: isQueueError, refetch: refetchQueue } = useGetDownloaderQueue(isAuthenticated);
  const { data: recentData, isLoading: isLoadingRecent, isFetching: isFetchingRecent, refetch: refetchRecent } = useGetRecentSuccesses(isAuthenticated);
  const downloadMutation = useDownloadMutation();

  useEffect(() => {
    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    window.addEventListener('downloader-unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('downloader-unauthorized', handleUnauthorized);
    };
  }, []);

  const validateAppleMusicUrl = (inputUrl: string) => {
    return /^https?:\/\/(beta\.)?music\.apple\.com\/.*$/.test(inputUrl);
  };

  const isYouTubeUrl = (u: string) => {
    return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//.test(u);
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (isYouTubeUrl(url)) {
      setPendingYtUrl(url);
      setSearchModalOpen(true);
      return;
    }

    if (!validateAppleMusicUrl(url)) {
      setErrorMsg('Please enter a valid Apple Music URL or YouTube URL.');
      return;
    }

    try {
      const response = await downloadMutation.mutateAsync(url);

      if (response && (response.error || response.success === false || response.status === 'error')) {
        setErrorMsg(response.error || response.message || 'Failed to start download.');
        return;
      }

      setUrl('');
      setSuccessMsg(response?.message || 'Successfully added to queue!');
      setTimeout(() => setSuccessMsg(''), 3000);
      refetchRecent();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start download.');
    }
  };

  const handleRefresh = () => {
    refetchQueue();
    refetchRecent();
  };

  if (!isAuthenticated) {
    return <DownloaderAuth onSuccess={() => setIsAuthenticated(true)} />;
  }

  const renderStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <FiCheckCircle className="text-green-500" />;
      case 'failed':
      case 'error':
        return <FiAlertCircle className="text-red-500" />;
      case 'downloading':
      case 'processing':
      case 'active':
        return <FiActivity className="text-primary animate-pulse" />;
      default:
        return <FiClock className="text-zinc-500" />;
    }
  };

  const renderQueueItem = (item: any, i: number, defaultStatus: string) => {
    const tracks = item.tracks ? Object.values(item.tracks) : [];
    const displayTracks = tracks.slice(0, 3);
    const hasMoreTracks = tracks.length > 3;

    return (
      <div key={item.job_id || item.id || i} className="p-4 hover:bg-zinc-800/50 transition-colors">
        <div className="flex items-center">
          <div className="mr-4 text-xl">
            {renderStatusIcon(item.status || defaultStatus)}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex items-center space-x-3">
              <div className="text-white font-medium truncate">{item.url || item.title || item.name || `Job ${item.job_id || item.id || i}`}</div>
              {item.task_type && (
                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-zinc-800 text-zinc-300 rounded-md flex-shrink-0">
                  {item.task_type}
                </span>
              )}
            </div>
            <div className="text-zinc-400 text-sm flex items-center space-x-2 mt-1">
              <span className="capitalize">{item.status || defaultStatus}</span>
              {item.total_tracks !== undefined && (
                <>
                  <span>•</span>
                  <span>{item.total_tracks} Tracks</span>
                </>
              )}
              {item.progress !== undefined && (
                <>
                  <span>•</span>
                  <span>{item.progress}%</span>
                </>
              )}
            </div>
          </div>
        </div>

        {displayTracks.length > 0 && (
          <div className="mt-3 ml-10 space-y-2 border-l-2 border-zinc-800 pl-4">
            {displayTracks.map((track: any, idx: number) => (
              <div key={idx} className="flex flex-col">
                <div className="text-zinc-300 text-sm font-medium truncate">{track.name || `Track ${idx + 1}`}</div>
                <div className="text-zinc-500 text-xs flex items-center space-x-2">
                  <span className={`capitalize ${track.status === 'SKIPPED' ? 'text-yellow-500' : track.status === 'ERROR' || track.status === 'FAILED' ? 'text-red-500' : track.status === 'COMPLETED' ? 'text-green-500' : ''}`}>
                    {track.status || 'Pending'}
                  </span>
                  {track.message && (
                    <>
                      <span>•</span>
                      <span className="truncate max-w-[200px]">{track.message}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
            {hasMoreTracks && (
              <div className="text-zinc-500 text-xs italic">
                + {tracks.length - 3} more tracks...
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderActiveTabContent = () => {
    if (isLoadingQueue || isLoadingRecent) {
      return (
        <div className="p-12 flex justify-center text-zinc-500">
          <FiRefreshCw className="animate-spin text-3xl" />
        </div>
      );
    }

    if (isQueueError) {
      return (
        <div className="p-12 text-center text-red-500">
          <FiAlertCircle className="text-3xl mx-auto mb-2" />
          Failed to load queue. Ensure the Downloader API is running and configured correctly.
        </div>
      );
    }

    // Safely parse worker
    const workerJobId = queueData?.worker?.current_job_id || queueData?.worker?.job_id;
    const hasWorker = !!workerJobId;

    // Safely parse main_queue using the detailed jobs array if available
    let mainQueueItems: any[] = [];
    if (queueData?.main_queue?.jobs) mainQueueItems = queueData.main_queue.jobs;
    else if (Array.isArray(queueData?.main_queue)) mainQueueItems = queueData.main_queue;
    else if (queueData?.main_queue?.job_ids) mainQueueItems = queueData.main_queue.job_ids.map((id: string) => ({ job_id: id }));
    const hasMain = mainQueueItems.length > 0;

    // Safely parse failed_queue using the detailed jobs array if available
    let failedQueueItems: any[] = [];
    if (queueData?.failed_queue?.jobs) failedQueueItems = queueData.failed_queue.jobs;
    else if (Array.isArray(queueData?.failed_queue)) failedQueueItems = queueData.failed_queue;
    else if (queueData?.failed_queue?.job_ids) failedQueueItems = queueData.failed_queue.job_ids.map((id: string) => ({ job_id: id }));
    const hasFailed = failedQueueItems.length > 0;

    let recentItems: any[] = [];
    if (recentData) {
      if (Array.isArray(recentData)) recentItems = recentData;
      else if (typeof recentData === 'object') recentItems = Object.keys(recentData).map(key => ({ id: key, ...recentData[key] }));
    }
    const hasRecent = recentItems.length > 0;

    if (activeTab === 'active') {
      if (!hasWorker) {
        return <div className="p-12 text-center text-zinc-500">Worker is currently idle. No active downloads.</div>;
      }
      return (
        <div className="divide-y divide-zinc-800">
          <LiveJobItem explicitJobId={workerJobId} defaultStatus="downloading" renderItem={renderQueueItem} />
        </div>
      );
    }

    if (activeTab === 'pending') {
      if (!hasMain) {
        return <div className="p-12 text-center text-zinc-500">Pending queue is empty.</div>;
      }
      return (
        <div className="divide-y divide-zinc-800">
          {mainQueueItems.map((item: any, i: number) => (
            <LiveJobItem key={item.job_id || item.id || i} explicitJobId={item.job_id || item.id} initialJob={item} defaultStatus="pending" renderItem={renderQueueItem} />
          ))}
        </div>
      );
    }

    if (activeTab === 'failed') {
      if (!hasFailed) {
        return <div className="p-12 text-center text-zinc-500">No failed jobs!</div>;
      }
      return (
        <div className="divide-y divide-zinc-800">
          {failedQueueItems.map((item: any, i: number) => (
            <LiveJobItem key={item.job_id || item.id || i} explicitJobId={item.job_id || item.id} initialJob={item} defaultStatus="failed" renderItem={renderQueueItem} />
          ))}
        </div>
      );
    }

    if (activeTab === 'recent') {
      if (!hasRecent) {
        return <div className="p-12 text-center text-zinc-500">No recent successes.</div>;
      }
      return (
        <div className="divide-y divide-zinc-800">
          {recentItems.map((item: any, i: number) => (
            <LiveJobItem key={item.job_id || item.id || i} explicitJobId={item.job_id || item.id} initialJob={item} defaultStatus="completed" renderItem={renderQueueItem} />
          ))}
        </div>
      );
    }

    return null;
  };

  const isRefreshing = isFetchingQueue || isFetchingRecent;

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-zinc-950 p-6 scrollbar-thin pb-32">
      <div className="max-w-4xl mx-auto w-full space-y-8">

        {/* Header & Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Apple Music Downloader</h1>
            <p className="text-zinc-400 mt-1">Queue and manage music downloads directly to your server.</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium text-sm disabled:opacity-50"
            >
              <FiRefreshCw className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* URL Input Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
          <form onSubmit={handleDownload}>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Apple Music URL</label>
            <div className="flex space-x-4">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://music.apple.com/..."
                className="flex-1 bg-zinc-950 border border-zinc-700 focus:border-primary text-white px-4 py-3 rounded-lg outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={!url || downloadMutation.isPending || (!validateAppleMusicUrl(url) && !isYouTubeUrl(url))}
                className="bg-primary hover:bg-purple-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-3 rounded-lg font-bold flex items-center transition-colors"
              >
                {downloadMutation.isPending ? <FiRefreshCw className="animate-spin" /> : <><FiDownload className="mr-2" /> Download</>}
              </button>
            </div>
            {errorMsg && <p className="text-red-500 text-sm mt-3 flex items-center"><FiAlertCircle className="mr-1" />{errorMsg}</p>}
            {successMsg && <p className="text-green-500 text-sm mt-3 flex items-center"><FiCheckCircle className="mr-1" />{successMsg}</p>}
            {!errorMsg && !successMsg && url && !validateAppleMusicUrl(url) && !isYouTubeUrl(url) && (
              <p className="text-yellow-500 text-sm mt-3 flex items-center"><FiAlertCircle className="mr-1" />Invalid URL format. Must be an Apple Music or YouTube link.</p>
            )}
          </form>
        </div>

        {/* Manual Search UI */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
          <label className="block text-sm font-medium text-zinc-400 mb-2">Search Apple Music Manually</label>
          <div className="flex space-x-4">
            <input
              type="text"
              value={manualTrack}
              onChange={(e) => setManualTrack(e.target.value)}
              placeholder="Song Name (e.g. Shape of You)"
              className="flex-1 bg-zinc-950 border border-zinc-700 focus:border-primary text-white px-4 py-3 rounded-lg outline-none transition-colors"
            />
            <input
              type="text"
              value={manualArtist}
              onChange={(e) => setManualArtist(e.target.value)}
              placeholder="Artist (Optional)"
              className="flex-1 bg-zinc-950 border border-zinc-700 focus:border-primary text-white px-4 py-3 rounded-lg outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => {
                setPendingYtUrl('');
                setSearchModalOpen(true);
              }}
              disabled={!manualTrack.trim() && !manualArtist.trim()}
              className="bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-white px-6 py-3 rounded-lg font-bold flex items-center transition-colors"
            >
              <FiSearch className="mr-2" /> Search
            </button>
          </div>
        </div>

        {/* Tabbed Queue View */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
          <div className="flex border-b border-zinc-800 bg-zinc-900/50">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'active' ? 'border-primary text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`}
            >
              Currently Downloading
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'pending' ? 'border-primary text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`}
            >
              Pending Queue
            </button>
            <button
              onClick={() => setActiveTab('failed')}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'failed' ? 'border-red-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`}
            >
              Failed Jobs
            </button>
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-6 py-4 text-sm font-medium transition-colors border-b-2 ${activeTab === 'recent' ? 'border-green-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'}`}
            >
              Recent Successes
            </button>
          </div>

          <div className="min-h-[200px]">
            {renderActiveTabContent()}
          </div>
        </div>

        <AppleMusicSearchModal
          isOpen={searchModalOpen}
          youtubeUrl={pendingYtUrl || undefined}
          initialTrack={!pendingYtUrl ? manualTrack : undefined}
          initialArtist={!pendingYtUrl ? manualArtist : undefined}
          onClose={() => {
            setSearchModalOpen(false);
            setPendingYtUrl('');
          }}
          onDownloadSuccess={(msg) => {
            setSearchModalOpen(false);
            setPendingYtUrl('');
            setUrl('');
            setManualTrack('');
            setManualArtist('');
            setSuccessMsg(msg);
            setTimeout(() => setSuccessMsg(''), 3000);
            refetchQueue();
            refetchRecent();
          }}
        />
      </div>
    </div>
  );
};
