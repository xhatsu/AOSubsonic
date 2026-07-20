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
  let artistClusterCache = null;
  let isCacheReady = false;

  let radioCachePromise = null;

  async function loadRadioCache() {
    if (radioCachePromise) return radioCachePromise;

    radioCachePromise = (async () => {
      const url = (process.env.SUPABASE_URL || '').trim();
      const key = (process.env.SUPABASE_KEY || '').trim();

      if (!url || !key) {
        console.error('Missing Supabase credentials');
        radioCachePromise = null;
        return false;
      }

      try {
        const res = await fetch(`${url}/rest/v1/radio_songs?select=id,title,artist,description,album,vector,language,year,scene&vector=not.is.null`, {
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
          }
        });

        if (!res.ok) {
          throw new Error('Supabase fetch failed: ' + res.status + ' ' + res.statusText);
        }

        const rows = await res.json();

        vectorCache = new Map();
        songMetaCache = new Map();
        artistClusterCache = new Map();

        // Fetch artist clusters for YouTube-like collaborative filtering
        try {
          const artistRes = await fetch(`${url}/rest/v1/radio_artists?select=artist_name,similar_artists`, {
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`
            }
          });
          if (artistRes.ok) {
            const artistRows = await artistRes.json();
            for (const row of artistRows) {
              if (row.artist_name && row.similar_artists) {
                artistClusterCache.set(row.artist_name.toLowerCase(), row.similar_artists);
              }
            }
          }
        } catch (err) {
          console.warn('Could not fetch radio_artists, skipping artist cluster bonus:', err.message);
        }

        for (const row of rows) {
          if (row.vector) {
            // Parse vector (Supabase returns a string representation or array)
            const vecArr = typeof row.vector === 'string' ? JSON.parse(row.vector) : row.vector;
            vectorCache.set(row.id, new Float32Array(vecArr));

            songMetaCache.set(row.id, {
              title: row.title,
              artist: row.artist,
              album: row.album,
              description: row.description || '',
              language: row.language || '',
              year: row.year || null,
              scene: row.scene || null
            });
          }
        }
        isCacheReady = true;
        return true;
      } catch (e) {
        console.error('Failed to load radio DB:', e);
        radioCachePromise = null;
        isCacheReady = false;
        return false;
      }
    })();
    return radioCachePromise;
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

  function getEraBonus(year1, year2) {
    if (!year1 || !year2) return 0;
    const y1 = parseInt(year1, 10);
    const y2 = parseInt(year2, 10);
    if (isNaN(y1) || isNaN(y2)) return 0;
    
    const diff = Math.abs(y1 - y2);
    if (diff <= 3) return 0.06;
    if (diff <= 7) return 0.04;
    if (diff <= 12) return 0.02;
    return 0;
  }

  const MOODS = ['dark', 'melancholic', 'neutral', 'bright', 'euphoric'];
  const ENERGIES = ['ambient', 'calm', 'moderate', 'energetic', 'explosive'];

  function extractVibe(desc) {
    if (!desc) return { mood: null, energy: null };
    const lower = desc.toLowerCase();
    
    let mood = null;
    for (let i = 0; i < MOODS.length; i++) {
      if (lower.includes(MOODS[i])) {
        mood = i;
        break;
      }
    }
    
    let energy = null;
    for (let i = 0; i < ENERGIES.length; i++) {
      if (lower.includes(ENERGIES[i])) {
        energy = i;
        break;
      }
    }
    return { mood, energy };
  }

  function getVibePenalty(v1, v2) {
    let penalty = 0;
    if (v1.mood !== null && v2.mood !== null) {
      const diff = Math.abs(v1.mood - v2.mood);
      if (diff >= 3) penalty += 0.15;
      else if (diff === 2) penalty += 0.08;
    }
    if (v1.energy !== null && v2.energy !== null) {
      const diff = Math.abs(v1.energy - v2.energy);
      if (diff >= 3) penalty += 0.15;
      else if (diff === 2) penalty += 0.08;
    }
    return penalty;
  }

  function buildCluster(seedId, count, candidateIds = null, languageStrictness = 0, sceneStrictness = 0.15) {
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
        score -= 0.10;
      }

      // Apply Language Match Bonus
      if (languageStrictness > 0 && seedMeta.language && candMeta.language) {
        if (seedMeta.language.toLowerCase() === candMeta.language.toLowerCase()) {
          score += languageStrictness;
        }
      }

      // Apply Era Match Bonus (smooth time delta to mimic YouTube's temporal clustering)
      score += getEraBonus(seedMeta.year, candMeta.year);

      // Apply Scene Match Bonus
      if (seedMeta.scene && candMeta.scene) {
        if (seedMeta.scene === candMeta.scene) {
          score += sceneStrictness;
        }
      }

      const candArtistTokens = extractArtists(candMeta.artist);
      if (seedArtistTokens.length > 0 && candArtistTokens.length > 0 && hasArtistOverlap(seedArtistTokens, candArtistTokens)) {
        score -= 0.04; // Soft penalty so it can still cluster similar artists
      }

      // Apply Artist Cluster Bonus (Collaborative Filtering mimicking YouTube)
      const candArtistStr = candMeta.artist ? candMeta.artist.toLowerCase() : '';
      const seedArtistStr = seedMeta.artist ? seedMeta.artist.toLowerCase() : '';
      if (artistClusterCache && seedArtistStr && candArtistStr) {
        // Find if any extracted token from seed matches an artist in our DB
        for (const seedToken of seedArtistTokens) {
          const similarArtists = artistClusterCache.get(seedToken);
          if (similarArtists) {
             const isSimilar = similarArtists.some(sa => candArtistStr.includes(sa.toLowerCase()));
             if (isSimilar) {
               score += 0.06; // Strong collaborative clustering bonus, but flexible enough to let vector math win
               break; // Only apply once
             }
          }
        }
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

  function findNextChainSong(currentSeedId, originalSeedId, excludeIds = [], languageStrictness = 0, sceneStrictness = 0.15, recentIds = []) {
    const currentVec = vectorCache.get(currentSeedId);
    const originalVec = vectorCache.get(originalSeedId);
    if (!currentVec || !originalVec) return null;

    const currentMeta = songMetaCache.get(currentSeedId) || {};
    const currentAlbum = currentMeta.album ? currentMeta.album.toLowerCase() : null;
    const currentArtistTokens = extractArtists(currentMeta.artist);

    // Build recent artist token frequency map for chain-history penalty
    const recentArtistTokenCounts = new Map();
    for (const rid of recentIds) {
      const rMeta = songMetaCache.get(rid);
      if (rMeta) {
        for (const t of extractArtists(rMeta.artist)) {
          recentArtistTokenCounts.set(t, (recentArtistTokenCounts.get(t) || 0) + 1);
        }
      }
    }

    const topN = 3;
    const candidates = [];

    const excludeSet = new Set(excludeIds);
    // Don't pick the seeds themselves either
    excludeSet.add(currentSeedId);
    excludeSet.add(originalSeedId);

    for (const [id, vec] of vectorCache) {
      if (excludeSet.has(id)) continue;
      const candMeta = songMetaCache.get(id);

      // 50% current step, 50% original anchor — stays much closer to the original vibe like YouTube Mixes
      const simCurrent = cosineSimilarity(currentVec, vec);
      const simOriginal = cosineSimilarity(originalVec, vec);
      let score = (0.5 * simCurrent) + (0.5 * simOriginal);

      // Apply penalties relative to current seed to force it to walk away from same album/artist
      if (currentAlbum && candMeta.album && candMeta.album.toLowerCase() === currentAlbum) {
        score -= 0.10;
      }

      // Apply Language Match Bonus
      if (languageStrictness > 0 && currentMeta.language && candMeta.language) {
        if (currentMeta.language.toLowerCase() === candMeta.language.toLowerCase()) {
          score += languageStrictness;
        }
      }

      // Apply Era Match Bonus (smooth time delta to mimic YouTube)
      score += getEraBonus(currentMeta.year, candMeta.year);

      // Apply Scene Match Bonus
      if (currentMeta.scene && candMeta.scene) {
        if (currentMeta.scene === candMeta.scene) {
          score += sceneStrictness;
        }
      }

      // Apply Vibe Guard Penalty
      const currentVibe = extractVibe(currentMeta.description);
      const candVibe = extractVibe(candMeta.description);
      score -= getVibePenalty(currentVibe, candVibe);

      const candArtistTokens = extractArtists(candMeta.artist);
      // Soft penalty for matching current song's artist
      if (currentArtistTokens.length > 0 && candArtistTokens.length > 0 && hasArtistOverlap(currentArtistTokens, candArtistTokens)) {
        score -= 0.04;
      }

      // Apply Artist Cluster Bonus (Collaborative Filtering mimicking YouTube)
      const candArtistStr = candMeta.artist ? candMeta.artist.toLowerCase() : '';
      const currentArtistStr = currentMeta.artist ? currentMeta.artist.toLowerCase() : '';
      if (artistClusterCache && currentArtistStr && candArtistStr) {
        for (const currentToken of currentArtistTokens) {
          const similarArtists = artistClusterCache.get(currentToken);
          if (similarArtists) {
             const isSimilar = similarArtists.some(sa => candArtistStr.includes(sa.toLowerCase()));
             if (isSimilar) {
               score += 0.06; // Strong collaborative clustering bonus, but flexible enough to let vector math win
               break;
             }
          }

        }
      }

      // Progressive penalty for matching any artist from the recent chain history
      // For first 5 songs it is gentle, but after 6+ it forces a switch
      if (recentArtistTokenCounts.size > 0 && candArtistTokens.length > 0) {
        for (const t of candArtistTokens) {
          const count = recentArtistTokenCounts.get(t);
          if (count) {
            if (count <= 2) score -= count * 0.01;         // 1-2 times
            else if (count <= 4) score -= count * 0.015;   // 3-4 times
            else if (count <= 6) score -= count * 0.025;   // 5-6 times
            else score -= count * 0.04;                    // 7+ times (forces switch)
          }
        }
      }

      candidates.push({ id, score, ...candMeta });
      candidates.sort((a, b) => b.score - a.score);
      if (candidates.length > topN) candidates.pop();
    }

    if (candidates.length === 0) return null;

    // Temperature-based weighted random sampling via softmax
    // Lower temperature = more bias towards highest score
    const temperature = 0.05;
    const expScores = candidates.map(c => Math.exp(c.score / temperature));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const probs = expScores.map(e => e / sumExp);

    let r = Math.random();
    for (let i = 0; i < candidates.length; i++) {
      r -= probs[i];
      if (r <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }



  app.get('/api/radio/status', (req, res) => {
    res.json({ ready: isCacheReady });
  });

  app.get('/api/radio/check', async (req, res) => {
    if (!songMetaCache) {
      const loaded = await loadRadioCache();
      if (!loaded) return res.json([]);
    }
    const ids = (req.query.ids || '').split(',').filter(Boolean);
    const existing = ids.filter(id => songMetaCache.has(id));
    res.json(existing);
  });

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
    if (!vectorCache) {
      const loaded = await loadRadioCache();
      if (!loaded) return res.status(404).json({ error: 'Radio db not found' });
    }
    const { songId } = req.params;
    const count = parseInt(req.query.count) || 30;
    const strictness = parseFloat(req.query.strictness) || 0;
    const sceneStrictness = parseFloat(req.query.sceneStrictness);
    const resolvedSceneStrictness = isNaN(sceneStrictness) ? 0.15 : sceneStrictness;

    if (!vectorCache.has(songId)) {
      return res.status(404).json({ error: 'Song not found in radio database.' });
    }

    const cluster = buildCluster(songId, count, null, strictness, resolvedSceneStrictness);
    res.json({ songs: cluster });
  });

  app.get('/api/radio/chain-next/:songId', async (req, res) => {
    if (!vectorCache) {
      const loaded = await loadRadioCache();
      if (!loaded) return res.status(404).json({ error: 'Radio db not found' });
    }
    const currentSeedId = req.params.songId;
    const originalSeedId = req.query.original || currentSeedId;
    const excludeIds = (req.query.exclude || '').split(',').filter(Boolean);
    const strictness = parseFloat(req.query.strictness) || 0;
    const sceneStrictness = parseFloat(req.query.sceneStrictness);
    const resolvedSceneStrictness = isNaN(sceneStrictness) ? 0.15 : sceneStrictness;
    const recentIds = (req.query.recent || '').split(',').filter(Boolean);

    if (!vectorCache.has(currentSeedId) || !vectorCache.has(originalSeedId)) {
      return res.status(404).json({ error: 'Seed song not found in radio database.' });
    }

    const nextSong = findNextChainSong(currentSeedId, originalSeedId, excludeIds, strictness, resolvedSceneStrictness, recentIds);
    res.json({ song: nextSong });
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

    // Pre-load the radio cache into memory at startup
    console.log('Pre-loading radio database cache from Supabase...');
    loadRadioCache().then(success => {
      if (success) {
        console.log('Radio vector cache pre-loaded successfully.');
      } else {
        console.warn('Failed to pre-load radio vector cache.');
      }
    });
  });
}

startServer().catch(console.error);
