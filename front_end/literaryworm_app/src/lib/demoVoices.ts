/**
 * The demo's natural voices: the Frankenstein sample upload (DEMO_NATURAL_SAMPLE) voiced once with
 * every natural voice by scripts/voice-demo-sample.mjs and served as static files, so the demo
 * plays them without calling Google or Supabase. Pieces are cut as for members (voiceSegments()).
 */

/** Where a recorded piece is, under public/ (and the site's root). */
export function demoVoicePath(voiceId: string, chapter: number, segment: number): string {
  return `voices/demo/${voiceId}-${chapter}-${segment}.mp3`;
}

/** The link the demo's player plays for a piece. */
export function demoVoiceUrl(voiceId: string, chapter: number, segment: number): Promise<string> {
  return Promise.resolve(`/${demoVoicePath(voiceId, chapter, segment)}`);
}
