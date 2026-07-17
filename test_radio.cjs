const Database = require('better-sqlite3');
const path = require('path');

const dbPath = '/home/ubuntu/tools/OSClient/osclient-web/data/songs.db';
const db = new Database(dbPath, { readonly: true });
const rows = db.prepare('SELECT id, title, artist, description, vector FROM songs WHERE vector IS NOT NULL').all();

console.log("Loaded", rows.length, "rows");

let energyBuckets = { calm: [], moderate: [], intense: [], mixed: [] };
let vectorCache = new Map();
let songMetaCache = new Map();

function scoreAxis(desc, lowKeywords, highKeywords) {
  if (!desc) return 0.5;
  const d = desc.toLowerCase();
  let score = 0.5;
  for (const w of lowKeywords) if (d.includes(w)) score -= 0.15;
  for (const w of highKeywords) if (d.includes(w)) score += 0.15;
  return Math.max(0, Math.min(1, score));
}

const AXES = {
  tempo: { low: ['slow', 'chill', 'laid-back', 'downtempo', 'languid', 'gentle', 'lazy'], high: ['fast', 'driving', 'high-tempo', 'explosive', 'rapid', 'frenetic', 'blistering', 'uptempo'] },
  vocal: { low: ['instrumental', 'no vocals', 'wordless'], high: ['duet', 'group', 'layered', 'choir', 'harmonies', 'chorus', 'chant', 'mixed vocals'] },
  mood: { low: ['dark', 'melancholic', 'haunting', 'somber', 'sad', 'brooding', 'moody'], high: ['bright', 'euphoric', 'uplifting', 'cheerful', 'sunny', 'happy', 'sweet'] },
  acousticness: { low: ['electronic', 'synth', 'digital', 'edm', 'techno', 'house', 'dubstep'], high: ['acoustic', 'organic', 'guitar', 'piano', 'strings', 'unplugged'] },
  distortion: { low: ['clean', 'polished', 'smooth', 'pristine', 'clear', 'slick'], high: ['raw', 'heavy', 'distorted', 'gritty', 'aggressive', 'fuzz', 'crunch'] },
  setting: { low: ['introspective', 'solitary', 'quiet', 'intimate', 'alone', 'personal'], high: ['social', 'party', 'festival', 'dancefloor', 'workout', 'club', 'anthem', 'celebratory'] }
};

for (const row of rows) {
  if (row.vector) {
    vectorCache.set(row.id, new Float32Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength / 4));
    
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
      description: desc,
      axes
    });

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

console.log("Vector cache:", vectorCache.size);

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function buildCluster(seedId, count, candidateIds = null) {
  const currentVec = vectorCache.get(seedId);
  if (!currentVec) return [];
  const results = [];
  const pool = candidateIds || Array.from(vectorCache.keys());
  for (const id of pool) {
    if (id === seedId) continue;
    const vec = vectorCache.get(id);
    if (!vec) continue;
    results.push({ id, score: cosineSimilarity(currentVec, vec), ...songMetaCache.get(id) });
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, count);
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
  if (parts.length > 0) return parts.slice(0, 2).join(" & ") + " Mix";
  return "Custom Tuned Mix";
}

const sections = [];
const sliders = { tempo: 0.5, vocal: 0.5, mood: 0.5, acousticness: 0.5, distortion: 0.5, setting: 0.5 };
let candidates = [];
let tolerance = 0.25;
while (candidates.length < 15 && tolerance <= 0.6) {
  candidates = [];
  for (const [id, meta] of songMetaCache.entries()) {
    const a = meta.axes;
    if (!a) continue;
    if (
      Math.abs(a.tempo - sliders.tempo) <= tolerance &&
      Math.abs(a.vocal - sliders.vocal) <= tolerance &&
      Math.abs(a.mood - sliders.mood) <= tolerance &&
      Math.abs(a.acousticness - sliders.acousticness) <= tolerance &&
      Math.abs(a.distortion - sliders.distortion) <= tolerance &&
      Math.abs(a.setting - sliders.setting) <= tolerance
    ) {
      candidates.push(id);
    }
  }
  if (candidates.length < 15) tolerance += 0.1;
}

console.log("Candidates:", candidates.length, "Tol:", tolerance);

if (candidates.length > 0) {
  const seedId = candidates[Math.floor(Math.random() * candidates.length)];
  const seedMeta = songMetaCache.get(seedId);
  const cluster = buildCluster(seedId, 20, candidates);
  sections.push({
    type: 'slider',
    title: autoLabel(sliders),
    description: `Based on '${seedMeta.title}' by ${seedMeta.artist}`,
    seedId: seedId,
    songs: cluster,
    meta: { poolSize: candidates.length, tolerance }
  });
}

const tiers = [
  { key: 'intense', title: 'High Energy Mix' },
  { key: 'moderate', title: 'Mid-Tempo Grooves' },
  { key: 'calm', title: 'Chill & Relax' },
];

for (const tier of tiers) {
  const bucket = energyBuckets[tier.key] || [];
  if (bucket.length > 0) {
    const seedId = bucket[Math.floor(Math.random() * bucket.length)];
    const cluster = buildCluster(seedId, 15);
    const seedMeta = songMetaCache.get(seedId);
    sections.push({
      type: 'auto',
      title: tier.title,
      description: `Inspired by '${seedMeta.title}' by ${seedMeta.artist}`,
      seedId: seedId,
      songs: cluster
    });
  }
}

console.log(JSON.stringify({ sections }, null, 2).substring(0, 500));
