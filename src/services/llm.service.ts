import { useHistoryStore } from '../store/history.store';
import { SubsonicController } from '../api/subsonic';

export interface LLMPlaylist {
  name: string;
  description: string;
  reason?: string;
  songIds: string[];
}

export interface LLMMoods {
  chill?: Omit<LLMPlaylist, 'name'>;
  energetic?: Omit<LLMPlaylist, 'name'>;
  melancholy?: Omit<LLMPlaylist, 'name'>;
  focus?: Omit<LLMPlaylist, 'name'>;
  party?: Omit<LLMPlaylist, 'name'>;
  [key: string]: Omit<LLMPlaylist, 'name'> | undefined;
}

export interface LLMResponse {
  playlists: LLMPlaylist[];
  moods: LLMMoods;
}

export class LLMService {
  
  static async generatePromptContext(ctrl: SubsonicController): Promise<string> {
    const history = useHistoryStore.getState();
    const topSongs = history.getTopSongs(30);
    const topArtists = history.getTopArtists(15);
    
    let context = `## Listener Profile\n\n`;
    context += `### Listening Stats\n`;
    context += `- Total listening time: ${Math.floor(history.totalListeningSeconds / 3600)} hours\n`;
    context += `- Total songs played (unique): ${Object.keys(history.songs).length}\n\n`;

    context += `### Top Artists\n`;
    topArtists.forEach((a, i) => {
      context += `${i + 1}. ${a.name} (${a.count} plays)\n`;
    });
    context += `\n`;

    context += `### Top Most-Played Songs\n`;
    context += `| Rank | Title | Artist | Album | Plays |\n`;
    context += `|---|---|---|---|---|\n`;
    topSongs.forEach((s, i) => {
      const title = (s.title || '').replace(/\|/g, '');
      const artist = (s.artist || '').replace(/\|/g, '');
      const album = (s.album || '').replace(/\|/g, '');
      context += `| ${i + 1} | ${title} | ${artist} | ${album} | ${s.count} |\n`;
    });
    context += `\n`;

    const allSongs = new Map();
    const maxSongs = 800;

    const fetchAlbumsToSongs = async (albumList: any[]) => {
      for (let i = 0; i < albumList.length; i += 10) {
        const chunk = albumList.slice(i, i + 10);
        const results = await Promise.all(
          chunk.map((a: any) => ctrl.getAlbum(a.id).catch(() => null))
        );

        for (const res of results) {
          const songs = res?.album?.song;
          if (songs) {
            const songArr = Array.isArray(songs) ? songs : [songs];
            for (const s of songArr) {
              allSongs.set(s.id, s);
              if (allSongs.size >= maxSongs) break;
            }
          }
        }
        if (allSongs.size >= maxSongs) break;
      }
    };

    try {
      const data = await ctrl.getAlbumList('frequent', 100, 0);
      let albumList = data.albumList?.album || [];
      if (!Array.isArray(albumList)) albumList = [albumList];
      await fetchAlbumsToSongs(albumList);
    } catch (e) {
      console.error(e);
    }

    if (allSongs.size < maxSongs) {
      try {
        const randomData = await ctrl.getRandomSongs(maxSongs - allSongs.size);
        let randomSongs = randomData.randomSongs?.song || [];
        if (!Array.isArray(randomSongs)) randomSongs = [randomSongs];
        for (const s of randomSongs) {
          allSongs.set(s.id, s);
          if (allSongs.size >= maxSongs) break;
        }
      } catch (e) {
        console.error(e);
      }
    }

    context += `## Full Library (${allSongs.size} songs provided for context)\n`;
    context += `| ID | Title | Artist | Album | Genre | Year | Duration |\n`;
    context += `|---|---|---|---|---|---|---|\n`;
    
    Array.from(allSongs.values()).forEach((s: any) => {
      const min = Math.floor(s.duration / 60);
      const sec = (s.duration % 60).toString().padStart(2, '0');
      const duration = `${min}:${sec}`;
      const title = (s.title || '').replace(/\|/g, '');
      const artist = (s.artist || '').replace(/\|/g, '');
      const album = (s.album || '').replace(/\|/g, '');
      const genre = (s.genre || '').replace(/\|/g, '');
      const year = s.year || '';
      
      context += `| ${s.id} | ${title} | ${artist} | ${album} | ${genre} | ${year} | ${duration} |\n`;
    });

    return context;
  }

  static getSystemPrompt(): string {
    return `You are an elite music curator and DJ with 20 years of experience crafting perfect playlists. You have deep knowledge of music theory, genre relationships, tempo mapping, and emotional arcs in music. You understand that a great playlist isn't just songs that sound similar — it's a journey with pacing, contrast, and flow.

## Your Task

Using ONLY songs from the library below, create personalized playlist recommendations for this listener. You must return:

1. **5-8 Themed Playlists** — Each playlist should be 15-30 songs.
   Think of these like Spotify's "Made For You" playlists.
   Each needs:
   - A creative, evocative name (not generic like "Chill Vibes")
   - A one-sentence description explaining the mood/vibe/purpose
   - A list of song IDs from the library
   - The reasoning: why this playlist fits this specific listener

2. **5 Mood Playlists** — Each mood playlist should be 10-20 songs.
   Required moods:
   - chill (relaxing, downtempo, peaceful)
   - energetic (upbeat, driving, high-energy)
   - melancholy (sad, reflective, emotional)
   - focus (ambient, instrumental-leaning, non-distracting)
   - party (danceable, fun, crowd-pleasing)

## Playlist Curation Rules

- **Flow matters**: Order songs so the playlist has a natural arc.
- **Avoid repetition**: Don't put multiple songs from the same album back-to-back.
- **Deep cuts over hits**: Prefer less-played songs from artists the user already loves.
- **Cross-pollinate**: Include songs from artists the user plays less frequently but that fit the mood.
- **Personalization > popularity**: Base decisions on THIS user's actual listening patterns.

## Output Format

Return ONLY valid JSON, no markdown formatting (\`\`\`json etc), no explanations outside the JSON:

{
  "playlists": [
    {
      "name": "Midnight Drive",
      "description": "Atmospheric tracks for late-night solo driving",
      "reason": "Your heavy rotation of Radiohead suggests you love spacious, layered production.",
      "songIds": ["id1", "id2", "id3"]
    }
  ],
  "moods": {
    "chill": {
      "songIds": ["id5", "id6"],
      "description": "Wind down with these mellow picks from your library"
    },
    "energetic": {
      "songIds": ["id8", "id9"],
      "description": "Your library's best tracks to get moving"
    },
    "melancholy": {
      "songIds": ["id11"],
      "description": "For when you want to sit with your feelings"
    },
    "focus": {
      "songIds": ["id14"],
      "description": "Background music that won't pull your attention"
    },
    "party": {
      "songIds": ["id17"],
      "description": "The most fun, danceable tracks you own"
    }
  }
}`;
  }

  static async fetchGemini(apiKey: string, prompt: string): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from Gemini API');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) throw new Error('Invalid response from Gemini');
    
    return JSON.parse(text) as LLMResponse;
  }

  static async fetchOpenAI(apiKey: string, prompt: string): Promise<LLMResponse> {
    const url = 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from OpenAI API');
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    
    if (!text) throw new Error('Invalid response from OpenAI');
    
    return JSON.parse(text) as LLMResponse;
  }
}
