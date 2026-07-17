const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const jwt = require('jsonwebtoken');

const isDev = process.env.NODE_ENV !== 'production' && !process.env.KUBERNETES_SERVICE_HOST && !process.env.KUBERNETES_PORT;
const PORT = process.env.PORT || (isDev ? 5173 : 80);
const JWT_SECRET = process.env.JWT_SECRET || process.env.VITE_DOWNLOADER_PASSWORD || 'admin-secret';
const rateLimits = new Map();

async function startServer() {
  const app = express();

  // Authentication Endpoint
  app.post('/api/downloader/auth/login', express.json(), (req, res) => {
    const ip = req.ip;
    const now = Date.now();

    if (rateLimits.has(ip)) {
      const limit = rateLimits.get(ip);
      if (limit.lockUntil > now) {
        return res.status(429).json({ error: 'Too many attempts. Try again later.' });
      }
    }

    const { password } = req.body;
    const expectedPassword = process.env.VITE_DOWNLOADER_PASSWORD || 'admin';

    if (password === expectedPassword) {
      rateLimits.delete(ip);
      const token = jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: '30m' });
      return res.json({ token });
    } else {
      const limit = rateLimits.get(ip) || { attempts: 0, lockUntil: 0 };
      limit.attempts += 1;
      if (limit.attempts >= 5) {
        limit.lockUntil = now + 5 * 60 * 1000; // 5 minutes
        limit.attempts = 0;
      }
      rateLimits.set(ip, limit);
      return res.status(401).json({ error: 'Incorrect password' });
    }
  });

  // Middleware for Downloader API
  const requireDownloaderAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    try {
      jwt.verify(token, JWT_SECRET);
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized or token expired' });
    }
  };

  // Proxy for YouTube oEmbed metadata (to avoid CORS)
  app.get('/api/yt-meta', async (req, res) => {
    const ytUrl = req.query.url;
    if (!ytUrl) return res.status(400).json({ error: 'Missing url parameter' });
    try {
      const oembedUrl = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(ytUrl) + '&format=json';
      const response = await fetch(oembedUrl);
      if (!response.ok) throw new Error('oEmbed failed');
      const data = await response.json();
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: 'Failed to fetch YouTube metadata' });
    }
  });

  // Proxy for Downloader API
  if (process.env.VITE_DOWNLOADER_API_URL) {
    app.use('/api/downloader', requireDownloaderAuth, createProxyMiddleware({
      target: process.env.VITE_DOWNLOADER_API_URL,
      changeOrigin: true,
      pathRewrite: {
        '^/api/downloader': '',
      },
      logLevel: 'info'
    }));
  } else {
    console.warn('WARNING: VITE_DOWNLOADER_API_URL is not set. Downloader proxy is inactive.');
  }

  // Proxy for YouTube Music API
  app.use('/api/ytm', createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true,
    logLevel: 'info'
  }));

  // Proxy for Lyrics API (unauthenticated for the player)
  if (process.env.VITE_DOWNLOADER_API_URL) {
    app.use('/api/lyrics', createProxyMiddleware({
      target: process.env.VITE_DOWNLOADER_API_URL,
      changeOrigin: true,
      pathRewrite: (path, req) => {
        // Because Express strips '/api/lyrics', path is usually '/?track=...'
        // We want to return '/lyrics?track=...'
        const queryOrPath = path.replace(/^\//, ''); // removes leading slash if any
        const newPath = '/lyrics' + queryOrPath;
        console.log(`[PROXY REWRITE] ${path} -> ${newPath}`);
        return newPath;
      },
      logLevel: 'info'
    }));
  }

  // Serve runtime environment variables to the frontend
  app.get('/api/env.js', (req, res) => {
    res.type('application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(`window.__RUNTIME_ENV__ = ${JSON.stringify({
      VITE_DOWNLOADER_API_URL: process.env.VITE_DOWNLOADER_API_URL || ''
    })};`);
  });

  // Smart Radio — read-only similarity endpoint
  let vectorCache = null;
  let songMetaCache = null;
  let energyBuckets = { calm: [], moderate: [], intense: [], mixed: [] };

  function scoreAxis(desc, lowKeywords, highKeywords) {
    if (!desc) return 0.5;
    const d = desc.toLowerCase();
    let score = 0.5;
    for (const w of lowKeywords) if (d.includes(w)) score -= 0.15;
    for (const w of highKeywords) if (d.includes(w)) score += 0.15;
    return Math.max(0, Math.min(1, score));
  }

  const AXES = {
    tempo: {
      low: ['slow', 'steady', 'mid', 'mid-tempo', 'laid-back', 'chill', 'languid'],
      high: ['fast', 'rapid', 'frantic', 'upbeat', 'chaotic', 'driving', 'high-tempo', 'explosive']
    },
    vocal: {
      low: ['instrumental', 'no vocals', 'wordless'],
      high: ['male', 'female', 'soaring', 'duet', 'mixed', 'autotuned', 'choir', 'harmonies', 'chorus', 'chant']
    },
    mood: {
      low: ['melancholic', 'sad', 'sorrowful', 'dark', 'moody', 'tense', 'bittersweet', 'haunting'],
      high: ['euphoric', 'uplifting', 'bright', 'cheerful', 'sunny', 'happy', 'sweet']
    },
    acousticness: {
      low: ['synth', 'synths', 'synthesizer', 'house', 'dance', 'trap', 'progressive', 'edm', 'electronic', 'drop', 'drops'],
      high: ['acoustic', 'piano', 'guitar', 'guitars', 'strings', 'string', 'orchestral', 'organic', 'unplugged']
    },
    distortion: {
      low: ['crisp', 'clean', 'smooth', 'soft', 'gentle', 'polished', 'pristine', 'clear'],
      high: ['heavy', 'distortion', 'aggressive', 'raw', 'metal', 'gritty', 'fuzz', 'crunch', 'intense']
    },
    setting: {
      low: ['gaming', 'focus', 'focused', 'studying', 'coffee', 'solitary', 'intimate', 'night', 'late', 'midnight', 'cozy', 'comforting', 'nostalgic', 'introspective', 'alone'],
      high: ['workout', 'workouts', 'cardio', 'gym', 'festival', 'club', 'driving', 'drive', 'highway', 'party', 'anthem', 'stadium', 'social', 'celebratory']
    }
  };

  async function loadRadioCache() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      console.error('Missing Supabase credentials');
      return false;
    }

    try {
      const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/radio_songs?select=id,title,artist,description,album,vector&vector=not.is.null`, {
        headers: {
          'apikey': process.env.SUPABASE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_KEY}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Supabase fetch failed: ' + res.statusText);
      }
      
      const rows = await res.json();

      vectorCache = new Map();
      songMetaCache = new Map();
      energyBuckets = { calm: [], moderate: [], intense: [], mixed: [] };

      for (const row of rows) {
        if (row.vector) {
          // Parse vector (Supabase returns a string representation or array)
          const vecArr = typeof row.vector === 'string' ? JSON.parse(row.vector) : row.vector;
          vectorCache.set(row.id, new Float32Array(vecArr));

          const desc = row.description || '';
          const axes = {
            tempo: scoreAxis(desc, AXES.tempo.low, AXES.tempo.high),
            vocal: scoreAxis(desc, AXES.vocal.low, AXES.vocal.high),
            mood: scoreAxis(desc, AXES.mood.low, AXES.mood.high),
            acousticness: scoreAxis(desc, AXES.acousticness.low, AXES.acousticness.high),
            distortion: scoreAxis(desc, AXES.distortion.low, AXES.distortion.high),
            setting: scoreAxis(desc, AXES.setting.low, AXES.setting.high)
          };

          songMetaCache.set(row.id, {
            title: row.title,
            artist: row.artist,
            album: row.album,
            description: desc,
            axes
          });

          // Energy bucket
          const energyMatch = desc.match(/Energy:\s*(\w+)/i);
          if (energyMatch) {
            const tag = energyMatch[1].toLowerCase();
            if (energyBuckets[tag]) energyBuckets[tag].push(row.id);
            else energyBuckets.mixed.push(row.id);
          } else {
            energyBuckets.mixed.push(row.id);
          }
        }
      }
      return true;
    } catch (e) {
      console.error('Failed to load radio DB:', e);
      return false;
    }
  }

  function cosineSimilarity(a, b) {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  function extractArtists(artistString) {
    if (!artistString) return [];
    return artistString.split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bx\b/i)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  function hasArtistOverlap(a1Tokens, a2Tokens) {
    for (const p1 of a1Tokens) {
      for (const p2 of a2Tokens) {
        if (p1 === p2) return true;
      }
    }
    return false;
  }

  function buildCluster(seedId, count, candidateIds = null) {
    const currentVec = vectorCache.get(seedId);
    if (!currentVec) return [];

    const seedMeta = songMetaCache.get(seedId) || {};
    const seedAlbum = seedMeta.album ? seedMeta.album.toLowerCase() : null;
    const seedArtistTokens = extractArtists(seedMeta.artist);

    const results = [];
    const pool = candidateIds || Array.from(vectorCache.keys());
    for (const id of pool) {
      if (id === seedId) continue;
      const vec = vectorCache.get(id);
      if (!vec) continue;

      const candMeta = songMetaCache.get(id);
      let score = cosineSimilarity(currentVec, vec);

      // Reduce points for same album or artist to encourage variety
      if (seedAlbum && candMeta.album && candMeta.album.toLowerCase() === seedAlbum) {
        score -= 0.15;
      }

      const candArtistTokens = extractArtists(candMeta.artist);
      if (seedArtistTokens.length > 0 && candArtistTokens.length > 0 && hasArtistOverlap(seedArtistTokens, candArtistTokens)) {
        score -= 0.25; // Heavy fuzzy penalty
      }

      results.push({ id, score, ...candMeta });
    }

    // Sort initially by score
    results.sort((a, b) => b.score - a.score);

    // Apply dynamic penalty for multiple songs from the same album/artist to ensure variety
    const finalCluster = [];
    const albumCounts = {};
    const artistCounts = {};

    const maxPerAlbum = Math.max(2, Math.floor(count / 15));
    const maxPerArtist = Math.max(2, Math.floor(count / 10));

    for (const song of results) {
      if (finalCluster.length >= count) break;
      const albumKey = song.album ? song.album.toLowerCase() : 'unknown_album_' + song.id;
      const albumCountSoFar = albumCounts[albumKey] || 0;

      // Force strict diversity
      if (albumCountSoFar >= maxPerAlbum && !albumKey.startsWith('unknown_album_')) {
        continue;
      }

      // Tokenize artist to limit features across the cluster
      const artistTokens = extractArtists(song.artist);
      if (artistTokens.length === 0) artistTokens.push('unknown_artist_' + song.id);

      let maxTokenCount = 0;
      for (const t of artistTokens) {
        if ((artistCounts[t] || 0) > maxTokenCount) maxTokenCount = artistCounts[t] || 0;
      }

      // fuzzy artist limit
      if (maxTokenCount >= maxPerArtist && !artistTokens[0].startsWith('unknown_artist_')) {
        continue;
      }

      albumCounts[albumKey] = albumCountSoFar + 1;
      for (const t of artistTokens) {
        artistCounts[t] = (artistCounts[t] || 0) + 1;
      }

      finalCluster.push(song);
    }

    return finalCluster;
  }

  function autoLabel(sliderVals) {
    let parts = [];
    if (sliderVals) {
      if (sliderVals.tempo > 0.65) parts.push("Fast");
      if (sliderVals.tempo < 0.35) parts.push("Slow");
      if (sliderVals.mood > 0.65) parts.push("Bright");
      if (sliderVals.mood < 0.35) parts.push("Dark");
      if (sliderVals.acousticness > 0.65) parts.push("Acoustic");
      if (sliderVals.acousticness < 0.35) parts.push("Electronic");
      if (sliderVals.distortion > 0.65) parts.push("Heavy");
      if (sliderVals.distortion < 0.35) parts.push("Clean");
      if (sliderVals.setting > 0.65) parts.push("Social");
      if (sliderVals.setting < 0.35) parts.push("Introspective");
    }

    // Shuffle to get a variety of descriptor combinations
    for (let i = parts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [parts[i], parts[j]] = [parts[j], parts[i]];
    }

    if (parts.length > 0) return parts.slice(0, 2).join(" & ") + " Mix";
    return "Custom Tuned Mix";
  }

  app.get('/api/radio/foryou', async (req, res) => {
    if (!vectorCache) {
      const loaded = await loadRadioCache();
      if (!loaded) {
        return res.status(404).json({ error: 'Radio database not found. Run the admin tool first.' });
      }
    } 
    const sections = [];

    // Generate 4 separate "Inspired by" mixes from frequent songs with distinct vectors
    let candidateSeedIds = Array.from(songMetaCache.keys());
    if (req.query.frequentAlbums) {
      const freqAlbums = req.query.frequentAlbums.split('|||').map((a) => a.toLowerCase());
      const freqIds = candidateSeedIds.filter((id) => {
        const meta = songMetaCache.get(id);
        return meta && meta.album && freqAlbums.includes(meta.album.toLowerCase());
      });
      if (freqIds.length >= 4) {
        candidateSeedIds = freqIds;
      }
    }

    const selectedSeeds = [];

    // Pick 4 distinct seeds
    for (let i = 0; i < 4; i++) {
      if (candidateSeedIds.length === 0) break;

      // Shuffle candidates slightly
      const sampleSize = Math.min(20, candidateSeedIds.length);
      const sample = [];
      for (let k = 0; k < sampleSize; k++) {
        sample.push(candidateSeedIds[Math.floor(Math.random() * candidateSeedIds.length)]);
      }

      // Pick a candidate that is most distinct (lowest max similarity) from already selected seeds
      let bestSeed = sample[0];
      let bestDistinctScore = -1; // Higher means more distinct

      for (const cand of sample) {
        if (selectedSeeds.length === 0) {
          bestSeed = cand;
          break;
        }
        const candVec = vectorCache.get(cand);
        let maxSim = -1;
        for (const sel of selectedSeeds) {
          const selVec = vectorCache.get(sel);
          const sim = cosineSimilarity(candVec, selVec);
          if (sim > maxSim) maxSim = sim;
        }
        const distinctScore = 1 - maxSim;
        if (distinctScore > bestDistinctScore) {
          bestDistinctScore = distinctScore;
          bestSeed = cand;
        }
      }

      selectedSeeds.push(bestSeed);
      // Remove the selected seed from candidates so it's not picked again
      candidateSeedIds = candidateSeedIds.filter((id) => id !== bestSeed);

      const cluster = buildCluster(bestSeed, 30);
      const seedMeta = songMetaCache.get(bestSeed);

      sections.push({
        type: 'auto',
        title: `Inspired by '${seedMeta.title}'`,
        description: `by ${seedMeta.artist}`,
        seedId: bestSeed,
        songs: cluster
      });
    }

    res.json({ sections });
  });

  app.get('/api/radio/similar/:songId', async (req, res) => {
    const { songId } = req.params;
    const count = parseInt(req.query.count) || 30;

    if (!vectorCache) {
      const loaded = await loadRadioCache();
      if (!loaded) {
        return res.status(404).json({ error: 'Radio database not found. Run the admin tool first.' });
      }
    }

    const currentVec = vectorCache.get(songId);
    if (!currentVec) {
      return res.status(404).json({ error: 'Song not found in radio database.' });
    }

    const results = [];
    for (const [id, vec] of vectorCache) {
      if (id === songId) continue;
      results.push({ id, score: cosineSimilarity(currentVec, vec), ...songMetaCache.get(id) });
    }

    results.sort((a, b) => b.score - a.score);
    const topSongs = results.filter(r => r.id !== songId).slice(0, count);
    res.json({ songs: topSongs });
  });

  app.post('/api/radio/prompt', express.json(), async (req, res) => {
    const { vector } = req.body;
    const count = parseInt(req.query.count) || 20;
    const strictness = parseFloat(req.query.strictness);
    const hasStrictness = !isNaN(strictness);

    if (!vector || !Array.isArray(vector)) {
      return res.status(400).json({ error: 'Valid dense vector required' });
    }

    if (!vectorCache) {
      const loaded = await loadRadioCache();
      if (!loaded) {
        return res.status(503).json({ error: 'Radio database not loaded.' });
      }
    }

    const results = [];
    for (const [id, vec] of vectorCache) {
      results.push({ id, score: cosineSimilarity(vector, vec), ...songMetaCache.get(id) });
    }

    results.sort((a, b) => b.score - a.score);
    
    const finalSongs = [];
    const albumCounts = {};
    const artistCounts = {};
    
    const maxPerArtist = Math.max(2, Math.floor(count / 10));
    const maxPerAlbum = Math.max(2, Math.floor(count / 20));
    
    const topScore = results.length > 0 ? results[0].score : 0;

    for (const song of results) {
      if (finalSongs.length >= count) break;

      // Gradient cutoff: For large requests (e.g. 200), if we have at least 100 songs 
      // and the vibe has drifted too far from the #1 best match, we stop early.
      if (hasStrictness && finalSongs.length >= Math.floor(count / 2)) {
        if (song.score < topScore - strictness) {
          break;
        }
      }
      
      const albumKey = song.album ? song.album.toLowerCase() : 'unknown_album_' + song.id;
      const albumCountSoFar = albumCounts[albumKey] || 0;
      if (albumCountSoFar >= maxPerAlbum && !albumKey.startsWith('unknown_album_')) {
        continue;
      }

      const artistTokens = extractArtists(song.artist);
      if (artistTokens.length === 0) artistTokens.push('unknown_artist_' + song.id);
      
      let maxTokenCount = 0;
      for (const t of artistTokens) {
        if ((artistCounts[t] || 0) > maxTokenCount) maxTokenCount = artistCounts[t] || 0;
      }
      
      if (maxTokenCount >= maxPerArtist && !artistTokens[0].startsWith('unknown_artist_')) {
        continue;
      }
      
      albumCounts[albumKey] = albumCountSoFar + 1;
      for (const t of artistTokens) {
        artistCounts[t] = (artistCounts[t] || 0) + 1;
      }
      
      finalSongs.push(song);
    }
    
    res.json({ songs: finalSongs });
  });

  if (isDev) {
    // Use Vite middleware in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the Vite build directory in production
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));

    app.use((req, res, next) => {
      if (req.method === 'GET' && req.accepts('html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        next();
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} (isDev: ${isDev})`);
  });
}

startServer().catch(console.error);
