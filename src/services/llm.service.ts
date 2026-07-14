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
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
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
    context += this.buildHistoryContext(topSongs);
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
    context += this.buildLibraryContext(Array.from(allSongs.values()));

    return context;
  }

  private static buildHistoryContext(history: any[]): string {
    let context = "id,title,artist,count\n";

    history.forEach(s => {
      const title = `"${(s.title || '').replace(/"/g, '""')}"`;
      const artist = `"${(s.artist || '').replace(/"/g, '""')}"`;
      context += `${s.id},${title},${artist},${s.count}\n`;
    });

    return context;
  }

  private static buildLibraryContext(library: any[]): string {
    let context = "id,title,artist,album,genre,year\n";

    library.forEach(s => {
      // Escape commas by wrapping in quotes
      const title = `"${(s.title || '').replace(/"/g, '""')}"`;
      const artist = `"${(s.artist || '').replace(/"/g, '""')}"`;
      const album = `"${(s.album || '').replace(/"/g, '""')}"`;
      const genre = `"${(s.genre || '').replace(/"/g, '""')}"`;
      const year = s.year || '';

      context += `${s.id},${title},${artist},${album},${genre},${year}\n`;
    });

    return context;
  }

  static getSystemPrompt(): string {
    return `You are an elite music curator and DJ with 20 years of experience crafting perfect playlists. You have deep knowledge of music theory, genre relationships, tempo mapping, and emotional arcs in music. You understand that a great playlist isn't just songs that sound similar — it's a journey with pacing, contrast, and flow.

## Your Task

Using ONLY songs from the library below, create personalized playlist recommendations for this listener. You must return:

1. **5-8 Themed Playlists** — Each playlist should be 15-30 songs.
   Think of these like Spotify's "Made For You" playlists. The focus should be on creating a flowing musical journey rather than just clumping similar-sounding songs or artists together. 
   Each needs:
   - A **simple, familiar name**. Avoid edgy, overly clever, or complex titles. Use everyday phrases that clearly set the vibe (e.g., "Refresh Day", "Time for Study", "Feeling Blue", "Up a Beat").
   - A one-sentence description explaining the mood/vibe/purpose.
   - A list of song IDs from the library.
   - The reasoning: why this playlist fits this specific listener.

2. **5 Mood Playlists** — Each mood playlist MUST be exactly 20 songs.
   Infer 5 unique moods based on the context of the listener's music taste (e.g., if they listen to metal, a mood might be 'aggressive', if jazz, it might be 'smooth').
   - Return 5 unique mood keys in the JSON matching the inferred moods.

## Playlist Curation Rules

- **Flow over clumping**: Order songs so the playlist has a natural, seamless sonic arc. Pay attention to transitions in tempo and energy rather than grouping exact sub-genres or styles together in chunks.
- **Avoid repetition**: Don't put multiple songs from the same album or artist back-to-back.
- **Deep cuts over hits**: Prefer less-played songs from artists the user already loves.
- **Cross-pollinate**: Include songs from artists the user plays less frequently but that bridge the gap between tracks and fit the mood.
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

  static async fetchOpenRouter(apiKey: string, model: string, prompt: string): Promise<LLMResponse> {
    const url = 'https://openrouter.ai/api/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || "openai/gpt-4o",
        response_format: { type: "json_object" },
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch from OpenRouter API');
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) throw new Error('Invalid response from OpenRouter');

    const parsed = JSON.parse(text) as LLMResponse;
    if (data.usage) {
      parsed.usage = {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens
      };
    }
    return parsed;
  }
}
