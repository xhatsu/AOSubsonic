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

export class DownloaderAPI {
  private baseUrl: string;

  constructor() {
    // Relying on the server-side proxy
    this.baseUrl = '/api/downloader';
  }

  // Strict URL Validation for Apple Music
  private validateUrl(url: string) {
    const appleMusicRegex = /^https?:\/\/(beta\.)?music\.apple\.com\/.*$/;
    if (!appleMusicRegex.test(url)) {
      throw new Error("Invalid URL. Must be a valid Apple Music URL (e.g., https://music.apple.com/...)");
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
        },
        body: JSON.stringify({ url } as DownloadRequest),
      });
    } catch (error) {
      throw new Error("Network error: Failed to connect to the API. Is the backend running?");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail?.[0]?.msg || `Download request failed with status ${response.status}`);
    }

    return response.json();
  }

  async getStatus(jobId: string): Promise<any> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");

    const response = await fetch(`${this.baseUrl}/status/${jobId}`);
    if (!response.ok) {
      throw new Error(`Failed to get status for job ${jobId}`);
    }
    return response.json();
  }

  async getQueue(): Promise<any> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");

    const response = await fetch(`${this.baseUrl}/queue?detailed=true&limit=100`);
    if (!response.ok) {
      throw new Error("Failed to fetch queue");
    }
    return response.json();
  }

  async getRecentSuccesses(): Promise<any> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");

    const response = await fetch(`${this.baseUrl}/recent-successes`);
    if (!response.ok) {
      throw new Error("Failed to fetch recent successes");
    }
    return response.json();
  }

  async resumeWorker(): Promise<any> {
    if (!this.baseUrl) throw new Error("Downloader API URL is not configured.");

    const response = await fetch(`${this.baseUrl}/resume`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error("Failed to resume worker");
    }
    return response.json();
  }
}

export const downloaderApi = new DownloaderAPI();
