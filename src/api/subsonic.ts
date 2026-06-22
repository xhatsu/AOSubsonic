import axios from 'axios';
import md5 from 'md5';

export interface SubsonicConfig {
  serverUrl: string;
  username: string;
  password?: string;
  token?: string; // If using pre-computed token/salt
  salt?: string;
  version?: string;
  client?: string;
}

const DEFAULT_VERSION = '1.16.1';
const DEFAULT_CLIENT = 'OSClientLite';

// Module-level cache to ensure identical URLs for browser caching of images
let globalSalt: string | null = null;
let globalToken: string | null = null;
let globalPassword: string | null = null;

export class SubsonicController {
  private config: SubsonicConfig;

  constructor(config: SubsonicConfig) {
    this.config = config;
  }

  private getAuthParams() {
    const { username, password, token, salt, version, client } = this.config;
    const v = version || DEFAULT_VERSION;
    const c = client || DEFAULT_CLIENT;

    if (token && salt) {
      return { u: username, t: token, s: salt, v, c, f: 'json' };
    }

    if (password) {
      if (globalPassword !== password || !globalSalt || !globalToken) {
        globalSalt = Math.random().toString(36).substring(2, 15);
        globalToken = md5(password + globalSalt);
        globalPassword = password;
      }
      return { u: username, t: globalToken, s: globalSalt, v, c, f: 'json' };
    }

    throw new Error('Authentication requires either password or token+salt');
  }

  private async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const authParams = this.getAuthParams();
    const url = `${this.config.serverUrl}/rest/${endpoint}`;
    
    try {
      const response = await axios.get(url, {
        params: { ...authParams, ...params },
      });
      
      const data = response.data['subsonic-response'];
      if (data.status === 'failed') {
        throw new Error(data.error?.message || 'API request failed');
      }
      return data;
    } catch (error) {
      console.error(`Subsonic API Error (${endpoint}):`, error);
      throw error;
    }
  }

  async ping() {
    return this.request('ping');
  }

  async getArtists() {
    return this.request<any>('getArtists');
  }

  async getAlbum(id: string) {
    return this.request<any>('getAlbum', { id });
  }

  async getSong(id: string) {
    return this.request<any>('getSong', { id });
  }

  async getArtist(id: string) {
    return this.request<any>('getArtist', { id });
  }

  async getArtistInfo2(id: string) {
    return this.request<any>('getArtistInfo2', { id });
  }

  async getAlbumList(type: string = 'newest', size: number = 40, offset: number = 0) {
    return this.request<any>('getAlbumList', { type, size, offset });
  }

  async getRandomSongs(size: number = 40, offset: number = 0) {
    return this.request<any>('getRandomSongs', { size, offset });
  }

  async getGenres() {
    return this.request<any>('getGenres');
  }

  async getAlbumList2(type: string = 'newest', size: number = 40, offset: number = 0, extra?: Record<string, string>) {
    return this.request<any>('getAlbumList2', { type, size, offset, ...extra });
  }

  async search3(query: string, artistCount: number = 10, albumCount: number = 10, songCount: number = 20) {
    return this.request<any>('search3', { query, artistCount, albumCount, songCount });
  }

  getCoverArtUrl(id: string, size?: number) {
    const authParams = this.getAuthParams();
    const url = new URL(`${this.config.serverUrl}/rest/getCoverArt`);
    url.searchParams.append('id', id);
    if (size) url.searchParams.append('size', size.toString());
    Object.entries(authParams).forEach(([key, value]) => {
      url.searchParams.append(key, value as string);
    });
    return url.toString();
  }

  getStreamUrl(id: string) {
    const authParams = this.getAuthParams();
    const url = new URL(`${this.config.serverUrl}/rest/stream`);
    url.searchParams.append('id', id);
    Object.entries(authParams).forEach(([key, value]) => {
      url.searchParams.append(key, value as string);
    });
    return url.toString();
  }
}
