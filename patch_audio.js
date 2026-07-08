const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/components/AudioPlayer.tsx');
let content = fs.readFileSync(file, 'utf8');

// Remove src prop from <audio>
content = content.replace(/src=\{currentSong\.streamUrl\}\n\s*/, '');

fs.writeFileSync(file, content);
