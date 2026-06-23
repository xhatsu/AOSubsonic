import type { QueueSong } from '../store/player.store';
// @ts-ignore
import { v1Tov2, parseAppleTTML } from './youlyplus/parser.js';

const KPOE_SERVERS = [
  'https://lyricsplus.prjktla.my.id',
  'https://lyricsplus.atomix.one',
  'https://lyricsplus.binimum.org',
  'https://lyricsplus-seven.vercel.app',
  'https://lyricsplus.prjktla.workers.dev',
  'https://lyrics-plus-backend.vercel.app',
];

const DEFAULT_KPOE_SOURCE_ORDER =
  'apple,lyricsplus,musixmatch,spotify,qq,deezer,musixmatch-word,genius';

function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId),
  );
}

export async function fetchLyrics(song: QueueSong, onFetchingUrl?: (url: string) => void) {
  if (!song) return null;

  try {
    const params = new URLSearchParams({
      track: song.title,
      artist: song.artist,
    });
    
    // Add duration in SECONDS if available
    if (song.duration && song.duration > 0) {
      params.append('duration', Math.round(song.duration).toString());
    }

    // 1. Try BiniLyrics Cache API first for ultra-fast TTML loading
    try {
      const cacheUrl = `https://lyrics-api.binimum.org/?${params.toString()}`;
      if (onFetchingUrl) onFetchingUrl(cacheUrl);
      const cacheRes = await fetchWithTimeout(cacheUrl);
      if (cacheRes.ok) {
        const cacheData = await cacheRes.json();
        if (cacheData && cacheData.results && cacheData.results.length > 0) {
          const result = cacheData.results[0];
          if (result.lyricsUrl) {
            if (onFetchingUrl) onFetchingUrl(result.lyricsUrl);
            const ttmlRes = await fetchWithTimeout(result.lyricsUrl);
            if (ttmlRes.ok) {
              const ttmlText = await ttmlRes.text();
              const parsedTTML = parseAppleTTML(ttmlText);
              if (parsedTTML && parsedTTML.lyrics && parsedTTML.lyrics.length > 0) {
                return {
                  ...parsedTTML,
                  data: parsedTTML.lyrics,
                  metadata: {
                    ...parsedTTML.metadata,
                    source: "BiniLyrics"
                  }
                };
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Cache API failed, falling back to KPOE sweep");
    }
    
    // 2. Fall back to sweeping KPOE_SERVERS
    params.append('source', DEFAULT_KPOE_SOURCE_ORDER);

    const shuffledServers = [...KPOE_SERVERS]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    let payload: any = null;

    for (const base of shuffledServers) {
      const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
      const targetUrl = `${normalizedBase}/v2/lyrics/get?${params.toString()}`;
      // Wrap the URL in a CORS proxy to allow fetching from the browser
      const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

      try {
        if (onFetchingUrl) onFetchingUrl(targetUrl);
        const response = await fetchWithTimeout(url);
        if (response.ok) {
          payload = await response.json();
          break; // break on first successful response
        }
      } catch (err) {
        // Ignore and try next server
      }
    }

    if (!payload) {
      // Fallback static lyrics if no sources found
      return {
        type: 'Line',
        data: [
          { time: 0, duration: 5000, text: 'Lyrics unavailable for this track', element: {} },
          { time: 5000, duration: (song.duration ? song.duration * 1000 : 300000), text: `${song.title} - ${song.artist}`, element: {} }
        ],
        metadata: {
          title: song.title,
          artist: song.artist,
          source: "Local Fallback"
        }
      };
    }

    // Convert potential v1 format to v2 using parser.js
    let lyricsObj = v1Tov2(payload);
    
    // The renderer expects `lyrics.data`, but the parser outputs `lyrics.lyrics`
    return {
      ...lyricsObj,
      data: lyricsObj.lyrics,
      metadata: {
        ...lyricsObj.metadata,
        source: lyricsObj.metadata?.source || payload.metadata?.source || "LyricsPlus (KPoe)"
      }
    };
  } catch (err) {
    console.error('Error fetching lyrics:', err);
    return null;
  }
}
