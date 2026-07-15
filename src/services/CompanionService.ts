import { usePlayerStore } from '../store/player.store';

type StateChangeCallback = (state: string) => void;
type TimeUpdateCallback = (position: number, duration: number) => void;
type ConnectionCallback = (connected: boolean, info?: { version: string; mpvVersion: string; wasapiExclusive?: boolean; wasapiDevice?: string }) => void;
type VoidCallback = () => void;

class CompanionService {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private shouldReconnect = false;

  private lastServerPos = 0;
  private lastServerTime = 0;
  private lastDuration = 0;
  private playing: boolean = false;
  private volume: number = 100;
  private lastCommandTime: number = 0;
  private lastSeekTime: number = 0;

  private _lyricsOffsetMs = 0;

  private lastTrackEndedTime = 0;
  private static TRACK_ENDED_DEBOUNCE_MS = 500;

  private timeUpdateCbs: TimeUpdateCallback[] = [];
  private trackEndedCbs: VoidCallback[] = [];
  private stateChangeCbs: StateChangeCallback[] = [];
  private connectionCbs: ConnectionCallback[] = [];

  constructor() {
    const saved = localStorage.getItem('companion_lyrics_offset_ms');
    if (saved !== null) {
      this._lyricsOffsetMs = parseInt(saved, 10) || 0;
    }
  }

  get lyricsOffsetMs(): number { return this._lyricsOffsetMs; }

  setLyricsOffsetMs(ms: number): void {
    this._lyricsOffsetMs = ms;
    localStorage.setItem('companion_lyrics_offset_ms', ms.toString());
  }

  connect(): void {
    if (this.ws || this.shouldReconnect) return;
    this.shouldReconnect = true;
    this.connectInner();
  }

  private connectInner(): void {
    if (!this.shouldReconnect) return;

    this.ws = new WebSocket('ws://127.0.0.1:12345');

    this.ws.onopen = () => {
      console.log('[companion] WebSocket connected');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      const config = usePlayerStore.getState().companionConfig;
      this.setConfig(config.wasapiExclusive, config.wasapiDevice);
    };

    this.ws.onclose = () => {
      console.log('[companion] WebSocket disconnected');
      this.ws = null;
      this.playing = false;
      this.connectionCbs.forEach(cb => cb(false));
      
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connectInner(), this.reconnectDelay);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[companion] WebSocket error:', err);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);
      } catch (e) {
        console.error('[companion] Error parsing ws message:', e);
      }
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private handleMessage(msg: { type: string; [key: string]: unknown }): void {
    switch (msg.type) {
      case 'hello':
        // Send the current volume immediately upon connection so it doesn't get dropped
        this.setVolume(this.volume);
        
        this.connectionCbs.forEach(cb => cb(true, {
          version: (msg.version as string) || '?',
          mpvVersion: (msg.mpvVersion as string) || '?',
          wasapiExclusive: msg.wasapiExclusive as boolean,
          wasapiDevice: msg.wasapiDevice as string || '',
        }));
        break;

      case 'time-update': {
        // Ignore time updates that arrive immediately after we send a SEEK command,
        // as they are likely stale messages already in transit.
        // We use a 2-second debounce because mpv can sometimes take over 1s to respond to a seek
        // over the network, especially on slower connections or if the file is large.
        if (performance.now() - this.lastSeekTime < 2000) {
          break;
        }
        const pos = msg.position as number;
        const dur = msg.duration as number;
        if (typeof pos === 'number' && !isNaN(pos)) {
          this.lastServerPos = pos;
          this.lastServerTime = performance.now();
        }
        if (typeof dur === 'number' && !isNaN(dur)) {
          this.lastDuration = dur;
        }
        this.timeUpdateCbs.forEach(cb => cb(this.lastServerPos, this.lastDuration));
        break;
      }

      case 'track-ended': {
        const now = performance.now();
        if (now - this.lastTrackEndedTime < CompanionService.TRACK_ENDED_DEBOUNCE_MS) {
          console.warn('[companion] Ignoring duplicate track-ended (debounced)');
          break;
        }
        this.lastTrackEndedTime = now;
        this.playing = false;
        this.trackEndedCbs.forEach(cb => cb());
        break;
      }

      case 'state-change': {
        const state = msg.state as string;
        // Ignore state changes that arrive immediately after we send a command,
        // as they are likely stale messages already in transit (race condition).
        if (performance.now() - this.lastCommandTime < 500) {
          console.warn(`[companion] Ignoring stale state-change '${state}' due to recent command`);
          break;
        }

        this.playing = (state === 'playing');
        if (this.playing) {
          this.lastServerTime = performance.now();
        }
        this.stateChangeCbs.forEach(cb => cb(state));
        break;
      }

      case 'error':
        console.error('[companion] mpv error:', msg.message);
        break;
    }
  }

  play(streamUrl: string): void {
    this.lastCommandTime = performance.now();
    this.lastServerPos = 0;
    this.lastServerTime = performance.now();
    this.lastDuration = 0;
    // DO NOT set this.playing = true here! Wait for the backend to emit state-change: playing.
    // If we set it true now, getRawPosition() instantly starts advancing time before the track actually starts, causing a visual stutter when the track actually begins and syncs back to 0.
    this.playing = false; 
    this.send({ type: 'play', url: streamUrl });
  }

  pause(): void { 
    this.lastCommandTime = performance.now();
    this.playing = false;
    this.stateChangeCbs.forEach(cb => cb('paused'));
    this.send({ type: 'pause' }); 
  }
  
  resume(): void { 
    this.lastCommandTime = performance.now();
    // Same here, let the backend dictate when it actually resumed to prevent time stutter
    this.playing = false;
    this.send({ type: 'resume' }); 
  }

  stop(): void {
    this.playing = false;
    this.lastServerPos = 0;
    this.lastDuration = 0;
    this.timeUpdateCbs.forEach(cb => cb(0, 0));
    this.send({ type: 'stop' });
  }

  seek(position: number): void {
    this.lastCommandTime = performance.now();
    this.lastSeekTime = performance.now();
    this.lastServerPos = position;
    this.lastServerTime = performance.now();
    this.send({ type: 'seek', position });
  }

  setVolume(level: number): void {
    this.volume = level;
    this.send({ type: 'volume', level });
  }

  setConfig(wasapiExclusive: boolean, wasapiDevice: string): void {
    this.send({ type: 'set_config', wasapiExclusive, wasapiDevice });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  getCurrentTime(): number {
    const raw = this.getRawPosition();
    return Math.max(0, raw + (this._lyricsOffsetMs / 1000));
  }

  getRawPosition(): number {
    if (!this.playing) return Math.max(0, this.lastServerPos);
    const elapsed = (performance.now() - this.lastServerTime) / 1000;
    const interpolated = this.lastServerPos + elapsed;
    if (this.lastDuration > 0) {
      return Math.max(0, Math.min(interpolated, this.lastDuration));
    }
    return Math.max(0, interpolated);
  }

  getDuration(): number { return this.lastDuration; }

  onTimeUpdate(cb: TimeUpdateCallback): () => void {
    this.timeUpdateCbs.push(cb);
    return () => { this.timeUpdateCbs = this.timeUpdateCbs.filter(c => c !== cb); };
  }
  onTrackEnded(cb: VoidCallback): () => void {
    this.trackEndedCbs.push(cb);
    return () => { this.trackEndedCbs = this.trackEndedCbs.filter(c => c !== cb); };
  }
  onStateChange(cb: StateChangeCallback): () => void {
    this.stateChangeCbs.push(cb);
    return () => { this.stateChangeCbs = this.stateChangeCbs.filter(c => c !== cb); };
  }
  onConnectionChange(cb: ConnectionCallback): () => void {
    this.connectionCbs.push(cb);
    return () => { this.connectionCbs = this.connectionCbs.filter(c => c !== cb); };
  }
}

export const companionService = new CompanionService();
