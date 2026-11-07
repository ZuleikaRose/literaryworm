import { type CastChoices, castNamesFor, castVoiceId, chapterPieces, type NaturalVoice, type VoicePiece, voicesFor } from "./naturalVoice";

/**
 * The demo's natural voices: its natural-voice sample uploads (DEMO_NATURAL_SAMPLES) voiced once
 * by scripts/voice-demo-sample.mjs and served as static files, so the demo plays them without
 * calling Google or Supabase. Pieces are cut as for members (chapterPieces()), with character
 * voices or without; every line of speech is recorded in every English character voice, so any
 * Who reads whom choice plays.
 */

/** Where a recorded piece is, under public/ (and the site's root): a folder per sample (the id's last two characters); character-voice pieces as "c3". */
export function demoVoicePath(bookId: string, voiceId: string, chapter: number, segment: number | string): string {
  return `voices/demo/${bookId.slice(-2)}/${voiceId}-${chapter}-${segment}.mp3`;
}

/** The link the demo's player plays for a piece. */
export function demoVoiceUrl(bookId: string, voiceId: string, chapter: number, segment: number | string): Promise<string> {
  return Promise.resolve(`/${demoVoicePath(bookId, voiceId, chapter, segment)}`);
}

/** Every recording a sample needs: its pieces for each English voice, with and without character voices. */
export function demoPieceFiles(bookId: string, chapters: string[]): { path: string; voice: string; text: string }[] {
  const files = new Map<string, { path: string; voice: string; text: string }>();
  const add = (voice: string, chapter: number, key: number | string, text: string) => {
    const path = demoVoicePath(bookId, voice, chapter, key);
    if (!files.has(path)) files.set(path, { path, voice, text });
  };
  for (const narrator of voicesFor("en")) {
    chapters.forEach((text, c) => {
      for (const cast of [false, true]) {
        chapterPieces(text, narrator, cast).forEach((piece, s) => {
          const key = piece.cast ? `c${s}` : s;
          add(piece.voice, c, key, piece.text);
          // A line of speech in every voice a listener could choose for its speaker.
          if (piece.cast && piece.voice !== narrator.id) {
            for (const name of castNamesFor(narrator.languageCode)) add(castVoiceId(narrator.languageCode, name), c, key, piece.text);
          }
        });
      }
    });
  }
  return [...files.values()];
}

/** A demo narrator's pieces and their recordings, like memberVoicePart() for members. */
export function demoVoicePart(bookId: string, narrator: NaturalVoice, chapters: string[], characterVoices: boolean, choices: CastChoices = {}) {
  const cut: VoicePiece[][] = [];
  const pieces = (text: string) => chapterPieces(text, narrator, characterVoices, choices);
  const piecesOf = (chapter: number) => (cut[chapter] ??= pieces(chapters[chapter] ?? ""));
  const url = (chapter: number, segment: number) => {
    const piece = piecesOf(chapter)[segment];
    return demoVoiceUrl(bookId, piece?.voice ?? narrator.id, chapter, piece?.cast ? `c${segment}` : segment);
  };
  return { url, pieces };
}
