// Natural voices for uploaded books: Google Cloud Text-to-Speech (Chirp 3: HD voices) reads a
// member's own upload, a piece at a time as they listen, and each piece is kept beside the upload
// so hearing it again costs nothing. This file is word for word the same in
// front_end/literaryworm_app/src/lib/naturalVoice.ts and supabase/functions/_shared/naturalVoice.ts
// (naturalVoice.test.ts checks), so the browser and the natural-voice function cut a chapter into
// the same pieces and agree on the voices and the limits. It has no imports, so it runs in both.

export type NaturalVoiceAccent = "British" | "American" | "Australian";

export interface NaturalVoice {
  /** Google's name for the voice. */
  id: string;
  /** The name shown in the player. */
  name: string;
  accent: NaturalVoiceAccent;
  languageCode: string;
}

/** The voices offered: a woman's and a man's in each accent the player offers. */
export const NATURAL_VOICES: readonly NaturalVoice[] = [
  { id: "en-GB-Chirp3-HD-Aoede", name: "Aoede", accent: "British", languageCode: "en-GB" },
  { id: "en-GB-Chirp3-HD-Charon", name: "Charon", accent: "British", languageCode: "en-GB" },
  { id: "en-US-Chirp3-HD-Kore", name: "Kore", accent: "American", languageCode: "en-US" },
  { id: "en-US-Chirp3-HD-Puck", name: "Puck", accent: "American", languageCode: "en-US" },
  { id: "en-AU-Chirp3-HD-Leda", name: "Leda", accent: "Australian", languageCode: "en-AU" },
  { id: "en-AU-Chirp3-HD-Fenrir", name: "Fenrir", accent: "Australian", languageCode: "en-AU" },
];

/** A British woman's voice, like the device voice the player picks first. */
export const DEFAULT_NATURAL_VOICE = "en-GB-Chirp3-HD-Aoede";

/** ProfileData.narrationVoice for a natural voice: this, then the voice's id. */
export const NATURAL_PREFIX = "natural:";

export function naturalVoice(id: string): NaturalVoice | null {
  return NATURAL_VOICES.find((v) => v.id === id) ?? null;
}

/** About how many characters a voice reads in an hour at normal speed (14 a second). */
export const CHARACTERS_PER_HOUR = 50400;

/**
 * Hours of new natural-voice reading each account can have voiced a month, by plan. Pieces
 * already voiced play again free; listening still counts towards the plan's audiobook hours.
 */
export const NATURAL_VOICE_HOURS: Record<string, number> = { basic: 2, standard: 6, premium: 12 };

/** This month's limit for a plan, in characters sent to Google (0 for anything else). */
export function naturalVoiceLimit(planId: string): number {
  return Math.round((Object.hasOwn(NATURAL_VOICE_HOURS, planId) ? NATURAL_VOICE_HOURS[planId] : 0) * CHARACTERS_PER_HOUR);
}

/** Whether a profile is offered natural voices for a book: members' own stored uploads, never on Kids profiles. */
export function naturalVoiceOffered(input: { member: boolean; ageRating: string | null; uploadPath: string | null }): boolean {
  return input.member && input.ageRating !== null && input.ageRating !== "kids" && input.uploadPath !== null;
}

/** The most characters in one piece: about 85 seconds of reading, and well under Google's 5,000 bytes a request. */
export const SEGMENT_CHARS = 1200;

export interface VoiceSegment {
  /** Where the piece starts in the chapter's text. */
  offset: number;
  text: string;
}

// After a sentence's end (with any closing quotes or brackets) and its spaces, or at a line break.
const BREAK = /[.!?…]["'”’)\]]*\s+|\n\s*/g;

/**
 * A chapter cut into the pieces a natural voice reads: whole sentences up to SEGMENT_CHARS, a
 * sentence longer than that at a space (or, with no space, at the limit).
 */
export function voiceSegments(chapter: string): VoiceSegment[] {
  const breaks: number[] = [];
  for (const m of chapter.matchAll(BREAK)) breaks.push((m.index ?? 0) + m[0].length);
  const segments: VoiceSegment[] = [];
  let start = 0;
  let b = 0;
  while (start < chapter.length) {
    while (start < chapter.length && /\s/.test(chapter[start])) start++;
    if (start >= chapter.length) break;
    let end = chapter.length;
    if (chapter.length - start > SEGMENT_CHARS) {
      const limit = start + SEGMENT_CHARS;
      while (b < breaks.length && breaks[b] <= start) b++;
      let best = -1;
      for (let i = b; i < breaks.length && breaks[i] <= limit; i++) best = breaks[i];
      if (best > start) end = best;
      else {
        const space = chapter.lastIndexOf(" ", limit);
        end = space > start ? space + 1 : limit;
      }
    }
    const text = chapter.slice(start, end).trimEnd();
    if (text) segments.push({ offset: start, text });
    start = end;
  }
  return segments;
}

/** The private bucket the voiced pieces are kept in. */
export const VOICE_BUCKET = "upload-voices";

/** Where one voiced piece is kept: the account's folder, then the upload's, so both delete as a folder. */
export function voiceFile(userId: string, uploadId: string, voiceId: string, chapter: number, segment: number): string {
  return `${userId}/${uploadId}/${voiceId}-${chapter}-${segment}.mp3`;
}
