const artistCounts = {};

function extractArtists(artistString) {
  if (!artistString) return [];
  return artistString.split(/[,&]|\bfeat\.?\b|\bft\.?\b|\bx\b/i)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

const songs = [
  { id: '1', artist: 'marasy' },
  { id: '2', artist: 'marasy' },
  { id: '3', artist: 'marasy' },
  { id: '4', artist: 'Tokyo Philharmonic Orchestra' },
  { id: '5', artist: 'marasy' },
  { id: '6', artist: 'Yiruma' },
  { id: '7', artist: 'marasy' }
];

const finalCluster = [];
for (const song of songs) {
  const artistTokens = extractArtists(song.artist);
  if (artistTokens.length === 0) artistTokens.push('unknown_artist_' + song.id);
  
  let maxTokenCount = 0;
  for (const t of artistTokens) {
    if ((artistCounts[t] || 0) > maxTokenCount) maxTokenCount = artistCounts[t] || 0;
  }
  
  if (maxTokenCount >= 2 && !artistTokens[0].startsWith('unknown_artist_')) {
    continue;
  }
  
  for (const t of artistTokens) {
    artistCounts[t] = (artistCounts[t] || 0) + 1;
  }
  
  finalCluster.push(song);
}

console.log(finalCluster.map(s => s.artist));
