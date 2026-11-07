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
  /** The book language it reads ("en", "fr", …). */
  language: string;
  /** English voices only: the accent the player groups it under. */
  accent: NaturalVoiceAccent | null;
  languageCode: string;
}

const voice = (languageCode: string, name: string, accent: NaturalVoiceAccent | null = null, language = languageCode.slice(0, 2)): NaturalVoice => ({
  id: `${languageCode}-Chirp3-HD-${name}`,
  name,
  language,
  accent,
  languageCode,
});

/**
 * The voices offered: a woman's and a man's in each English accent the player offers, and in
 * each of the app's other languages, for books written in them.
 */
export const NATURAL_VOICES: readonly NaturalVoice[] = [
  voice("en-GB", "Aoede", "British"),
  voice("en-GB", "Charon", "British"),
  voice("en-US", "Kore", "American"),
  voice("en-US", "Puck", "American"),
  voice("en-AU", "Leda", "Australian"),
  voice("en-AU", "Fenrir", "Australian"),
  voice("fr-FR", "Aoede"),
  voice("fr-FR", "Charon"),
  voice("de-DE", "Aoede"),
  voice("de-DE", "Charon"),
  voice("es-ES", "Aoede"),
  voice("es-ES", "Charon"),
  voice("it-IT", "Aoede"),
  voice("it-IT", "Charon"),
  voice("pt-BR", "Aoede"),
  voice("pt-BR", "Charon"),
  voice("nl-NL", "Aoede"),
  voice("nl-NL", "Charon"),
  voice("ja-JP", "Aoede"),
  voice("ja-JP", "Charon"),
  // Google's codes for Mandarin, Arabic and Filipino (Tagalog) aren't the book's two letters.
  voice("cmn-CN", "Aoede", null, "zh"),
  voice("cmn-CN", "Charon", null, "zh"),
  voice("ko-KR", "Aoede"),
  voice("ko-KR", "Charon"),
  voice("hi-IN", "Aoede"),
  voice("hi-IN", "Charon"),
  voice("ar-XA", "Aoede", null, "ar"),
  voice("ar-XA", "Charon", null, "ar"),
  voice("pl-PL", "Aoede"),
  voice("pl-PL", "Charon"),
  voice("ru-RU", "Aoede"),
  voice("ru-RU", "Charon"),
  voice("tr-TR", "Aoede"),
  voice("tr-TR", "Charon"),
  voice("sv-SE", "Aoede"),
  voice("sv-SE", "Charon"),
  voice("uk-UA", "Aoede"),
  voice("uk-UA", "Charon"),
  voice("fil-PH", "Aoede", null, "tl"),
  voice("fil-PH", "Charon", null, "tl"),
];

/** The languages natural voices read, besides English (two letters, as uploaded_books.language keeps them). */
export const NATURAL_LANGUAGES = ["fr", "de", "es", "it", "pt", "nl", "ja", "zh", "ko", "hi", "ar", "pl", "ru", "tr", "sv", "uk", "tl"] as const;

/** The voices offered for a book: its own language's first (when there are some), then English. */
export function voicesFor(language: string | null): NaturalVoice[] {
  const own = language && language !== "en" ? NATURAL_VOICES.filter((v) => v.language === language) : [];
  return [...own, ...NATURAL_VOICES.filter((v) => v.language === "en")];
}

/** The voice a book starts with: its language's first, else a British woman's. */
export function defaultNaturalVoice(language: string | null): NaturalVoice {
  return voicesFor(language)[0];
}

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

/** The share of the month's natural-voice reading at which the bell gives a heads-up. */
export const NATURAL_VOICE_ALERT_SHARE = 0.8;

/** The month natural_voice_usage counts in: its first day, in UTC ("2026-11-01"). */
export function naturalVoiceMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Seconds of new natural-voice reading used and left this month, from characters used. */
export function naturalVoiceTime(planId: string, characters: number): { used: number; left: number; limit: number } {
  const perSecond = CHARACTERS_PER_HOUR / 3600;
  const limit = naturalVoiceLimit(planId) / perSecond;
  const used = Math.min(limit, characters / perSecond);
  return { used, left: limit - used, limit };
}

/** This month's limit for a plan, in characters sent to Google (0 for anything else). */
export function naturalVoiceLimit(planId: string): number {
  return Math.round((Object.hasOwn(NATURAL_VOICE_HOURS, planId) ? NATURAL_VOICE_HOURS[planId] : 0) * CHARACTERS_PER_HOUR);
}

/** Whether a profile is offered natural voices for a book: members' own stored uploads, never on Kids profiles. */
export function naturalVoiceOffered(input: { member: boolean; ageRating: string | null; uploadPath: string | null }): boolean {
  return input.member && input.ageRating !== null && input.ageRating !== "kids" && input.uploadPath !== null;
}

/**
 * The most characters in one piece: about 85 seconds of reading in English, and under Google's
 * 5,000 bytes a request even in scripts of three bytes a character (Chinese, Japanese, Hindi).
 */
export const SEGMENT_CHARS = 1200;

export interface VoiceSegment {
  /** Where the piece starts in the chapter's text. */
  offset: number;
  text: string;
}

// After a sentence's end (with any closing quotes or brackets) and its spaces; after a Chinese or
// Japanese full stop, a Hindi danda or an Arabic question mark (spaces or not); or at a line break.
const BREAK = /[.!?…]["'”’)\]]*\s+|[。！？।؟][」』”’)）]*\s*|\n\s*/g;

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

/**
 * Where one voiced piece is kept: the account's folder, then the upload's, so both delete as a
 * folder. Pieces cut for character voices (chapterPieces()) are numbered apart, with a "c".
 */
export function voiceFile(userId: string, uploadId: string, voiceId: string, chapter: number, segment: number, cast = false): string {
  return `${userId}/${uploadId}/${voiceId}-${chapter}-${cast ? "c" : ""}${segment}.mp3`;
}

/**
 * Character voices: when the listener turns them on, what the characters say (the text inside
 * double quotes, “…”, "…", «…» or „…“) is read by other voices than the narration. A speaker named
 * beside the words ("said Elizabeth", "Mr. Darcy replied") keeps the same voice all book long;
 * words with no named speaker take the speaker named elsewhere in the same paragraph, else one
 * voice kept for speech. Voices are dealt out, not matched to the character. Names are found in
 * English books; in other languages speech still gets its own voice. Chapters with no speech are
 * read exactly as without character voices (the same pieces, the same files).
 */
export const CAST_NAMES: readonly string[] = ["Charon", "Kore", "Puck", "Leda", "Fenrir", "Zephyr", "Orus", "Despina"];

export interface VoicePiece extends VoiceSegment {
  /** The voice that reads it (Google's name). */
  voice: string;
  /** Cut for character voices (numbered apart in voiceFile()). */
  cast: boolean;
}

export interface CastSegment extends VoiceSegment {
  speech: boolean;
  /** The speaker named for it, when there is one. */
  speaker: string | null;
}

const SAID =
  "said|says|asked|asks|cried|replied|answered|shouted|whispered|exclaimed|continued|added|returned|called|muttered|murmured|began|remarked|observed|declared|repeated|insisted|demanded|inquired|enquired|sighed|laughed|growled|snapped";
const NAME = "(?:(?:Mr|Mrs|Ms|Miss|Dr|Lady|Lord|Sir|Captain|Aunt|Uncle|Madame|Monsieur)\\.?\\s+)?[A-Z][a-zà-ÿ'’-]+";
const AFTER = new RegExp(`^[,.!?;:—–-]?\\s*(?:(${NAME})\\s+(?:${SAID})\\b|(?:${SAID})\\s+(${NAME}))`);
const BEFORE = new RegExp(`(?:(${NAME})\\s+(?:${SAID})|(?:${SAID})\\s+(${NAME}))\\s*[,:]?\\s*$`);
const NOT_NAMES = new Set(["he", "she", "i", "they", "it", "we", "you", "one", "the", "this", "that", "then", "there", "her", "his", "him", "someone", "everyone", "nobody", "somebody"]);
// Words inside double quotes, to the end of the paragraph when the closing quote is left off (as
// novels do when a speech runs on into the next paragraph).
const QUOTED = /“[^”\n]*(?:”|(?=\n)|$)|"[^"\n]*(?:"|(?=\n)|$)|«[^»\n]*(?:»|(?=\n)|$)|„[^“”\n]*(?:[“”]|(?=\n)|$)/g;

function speakerIn(match: RegExpExecArray | null): string | null {
  const name = match ? (match[1] ?? match[2] ?? null) : null;
  return name && !NOT_NAMES.has(name.toLowerCase()) ? name.replace(/\s+/g, " ") : null;
}

/**
 * A chapter cut into narration and speech, each part as long as voiceSegments() allows, with the
 * speaker named for each speech; null when the chapter has no speech (read as voiceSegments()).
 */
export function castSegments(chapter: string): CastSegment[] | null {
  const quotes: { start: number; end: number; speaker: string | null }[] = [];
  for (const m of chapter.matchAll(QUOTED)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    // Something to say: a letter or digit inside the quotes.
    if (!/[\p{L}\p{N}]/u.test(m[0])) continue;
    const lineStart = chapter.lastIndexOf("\n", start - 1) + 1;
    const nextQuote = chapter.slice(end).search(/[“"«„\n]/);
    const after = chapter.slice(end, nextQuote < 0 ? chapter.length : end + nextQuote);
    const before = chapter.slice(Math.max(lineStart, start - 60), start);
    quotes.push({ start, end, speaker: speakerIn(AFTER.exec(after)) ?? speakerIn(BEFORE.exec(before)) });
  }
  if (!quotes.length) return null;
  // Unnamed speech takes the speaker named nearest it in the same paragraph.
  const paragraphOf = (at: number) => chapter.lastIndexOf("\n", at - 1);
  quotes.forEach((q, i) => {
    if (q.speaker) return;
    const p = paragraphOf(q.start);
    for (let d = 1; d < quotes.length; d++) {
      for (const j of [i - d, i + d]) {
        const other = quotes[j];
        if (other && other.speaker && paragraphOf(other.start) === p) {
          q.speaker = other.speaker;
          return;
        }
      }
    }
  });

  const parts: CastSegment[] = [];
  const add = (start: number, end: number, speech: boolean, speaker: string | null) => {
    const text = chapter.slice(start, end);
    // Narration between speeches that's only spaces and punctuation isn't read.
    if (!/[\p{L}\p{N}]/u.test(text)) return;
    for (const piece of voiceSegments(text)) parts.push({ offset: start + piece.offset, text: piece.text, speech, speaker });
  };
  let at = 0;
  for (const q of quotes) {
    add(at, q.start, false, null);
    add(q.start, q.end, true, q.speaker);
    at = q.end;
  }
  add(at, chapter.length, false, null);
  return parts;
}

/** The character voice for a speech: another voice than the narrator's, the same one for a speaker every time. */
export function speakerVoice(narrator: NaturalVoice, speaker: string | null): string {
  const own = narrator.id.slice(narrator.id.lastIndexOf("-") + 1);
  const pool = CAST_NAMES.filter((n) => n !== own);
  let pick = pool[0];
  if (speaker) {
    let hash = 0;
    for (const ch of speaker.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    pick = pool[1 + (hash % (pool.length - 1))];
  }
  return `${narrator.languageCode}-Chirp3-HD-${pick}`;
}

/** A chapter's pieces as the narrator reads them, with character voices or without. */
export function chapterPieces(chapter: string, narrator: NaturalVoice, characterVoices: boolean): VoicePiece[] {
  const cast = characterVoices ? castSegments(chapter) : null;
  if (!cast) return voiceSegments(chapter).map((p) => ({ ...p, voice: narrator.id, cast: false }));
  return cast.map((p) => ({ offset: p.offset, text: p.text, voice: p.speech ? speakerVoice(narrator, p.speaker) : narrator.id, cast: true }));
}
