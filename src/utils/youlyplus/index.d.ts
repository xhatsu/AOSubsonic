declare module '../utils/youlyplus/lyricsRenderer' {
  const LyricsPlusRenderer: any;
  export default LyricsPlusRenderer;
}

declare module './youlyplus/parser.js' {
  export function parseSyncedLyrics(lrcContent: string): any;
  export function parseAppleTTML(ttml: string, offset?: number, separate?: boolean): any;
  export function convertToStandardJson(parsedLyrics: any): any;
  export function v1Tov2(data: any): any;
}
