export interface DownloadRequest {
  url: string;
}

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
  input?: any;
  ctx?: Record<string, any>;
}

export interface HTTPValidationError {
  detail: ValidationError[];
}

export interface AppleMusicSearchResult {
  track_name: string;
  artist_name: string;
  album_name: string;
  duration_ms: number;
  song_id: string;
  storefront: string;
  url: string;
}

export interface YouTubeParsedInfo {
  track: string;
  artist: string;
  rawTitle: string;
}

export class DownloaderAPI {
  private baseUrl: string;
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (token) {
      localStorage.setItem('downloader_jwt', token);
    } else {
      localStorage.removeItem('downloader_jwt');
    }
  }

  getToken() {
    return this.token;
  }

  async login(password: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    this.token = data.token;
    localStorage.setItem('downloader_jwt', data.token);
    return data.token;
  }

  private getAuthHeaders(): Record<string, string> {
    return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
  }

  private handleResponse(response: Response): Response {
    if (response.status === 401) {
      this.setToken('');
      window.dispatchEvent(new Event('downloader-unauthorized'));
    }
    return response;
  }

  constructor() {
    // Relying on the server-side proxy
    this.baseUrl = '/api/downloader';
    this.token = localStorage.getItem('downloader_jwt');
  }

  // Strict URL Validation for Apple Music and YouTube
  private validateUrl(url: string) {
    const appleMusicRegex = /^https?:\/\/(beta\.)?music\.apple\.com\/.*$/;
    const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\/.*$/;
    if (!appleMusicRegex.test(url) && !youtubeRegex.test(url)) {
      throw new Error("Invalid URL. Must be a valid Apple Music or YouTube URL.");
    }
  }

  async download(url: string): Promise<any> {
    this.validateUrl(url);

    if (!this.baseUrl) {
      throw new Error("Downloader API URL is not configured. Please set VITE_DOWNLOADER_API_URL in .env");
    }

    let response;
    try {
      response = await fetch(`${this.baseUrl}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ url } as DownloadRequest),
      });
    } catch (error) {
      throw new Error("Network error: Failed to connect to the API. Is the backend running?");
    }

    if (!response.ok) {
      this.handleResponse(response);
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail?.[0]?.msg || `Download request failed with status ${response.status}`);
    }

    return response.json();
  }

  async fetchYouTubeMeta(youtubeUrl: string): Promise<YouTubeParsedInfo> {
    const res = await fetch(`/api/yt-meta?url=${encodeURIComponent(youtubeUrl)}`);
    if (!res.ok) {
      throw new Error("Failed to fetch YouTube metadata");
    }
    const data = await res.json();
    const rawTitle = data.title || "";
    
    // Attempt to split title into Artist - Track
    let artist = "";
    let track = rawTitle;
    
    // Strip everything after |
    if (track.includes("|")) {
      track = track.split("|")[0].trim();
    }
    
    // Strip common YouTube suffixes
    const suffixRegex = /(\s*(?:\[|\()(?:official\s*(?:music\s*)?video|lyrics?|audio|m\/?v)(?:\]|\))\s*)/i;
    track = track.replace(suffixRegex, "").trim();

    if (track.includes(" - ")) {
      const parts = track.split(" - ");
      artist = parts[0].trim();
      track = parts.slice(1).join(" - ").trim();
    }
    
    return { track, artist, rawTitle };
  }

  async searchAppleMusic(track: string, artist: string, limit: number = 5): Promise<AppleMusicSearchResult[]> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");
    
    const params = new URLSearchParams();
    params.append('track', track);
    params.append('artist', artist);
    params.append('limit', limit.toString());

    const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
      headers: this.getAuthHeaders()
    });
    this.handleResponse(response);
    if (!response.ok) {
      throw new Error("Failed to search Apple Music");
    }
    const data = await response.json();
    
    if (data && Array.isArray(data.results)) {
        return data.results;
    }
    
    // Wrap in array if API returned a single object instead of an array
    if (!Array.isArray(data)) {
        if (data.status === 'success' && data.url) {
            return [data as AppleMusicSearchResult];
        }
        return [];
    }
    return data;
  }

  async checkLibraryPresence(songIds: string[]): Promise<string[]> {
    if (songIds.length === 0) return [];
    try {
      const res = await fetch(`/api/radio/check?ids=${songIds.join(',')}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('Failed to check library presence:', e);
      return [];
    }
  }

  async getStatus(jobId: string): Promise<any> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");

    const response = await fetch(`${this.baseUrl}/status/${jobId}`, {
      headers: this.getAuthHeaders()
    });
    this.handleResponse(response);
    if (!response.ok) {
      throw new Error(`Failed to get status for job ${jobId}`);
    }
    return response.json();
  }

  async getQueue(): Promise<any> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");

    const response = await fetch(`${this.baseUrl}/queue?detailed=true&limit=100`, {
      headers: this.getAuthHeaders()
    });
    this.handleResponse(response);
    if (!response.ok) {
      throw new Error("Failed to fetch queue");
    }
    return response.json();
  }

  async getRecentSuccesses(): Promise<any> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");

    const response = await fetch(`${this.baseUrl}/recent-successes`, {
      headers: this.getAuthHeaders()
    });
    this.handleResponse(response);
    if (!response.ok) {
      throw new Error("Failed to fetch recent successes");
    }
    return response.json();
  }

  async resumeWorker(): Promise<any> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");

    const response = await fetch(`${this.baseUrl}/resume`, {
      method: 'POST',
      headers: this.getAuthHeaders()
    });
    this.handleResponse(response);
    
    if (!response.ok) {
      throw new Error("Failed to resume worker");
    }
    return response.json();
  }
}

export const downloaderApi = new DownloaderAPI();
