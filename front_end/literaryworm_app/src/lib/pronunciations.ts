import { tr } from "./i18n";
import { parsePronunciations, PRONOUNCE_SAY_MAX, PRONOUNCE_WORD_MAX, type Pronunciations, PRONUNCIATIONS_MAX, validPronunciation } from "./naturalVoice";

/**
 * Pronunciations, per book (PlayerSettings.pronunciations, members' reader_profiles.pronunciations):
 * the listener's respellings of names a natural voice says wrongly, sent with the parts that have
 * them (sayAs() and pronunciationKey() in naturalVoice.ts). Kept with the player settings, like
 * Who reads whom.
 */

/** The most books a profile keeps pronunciations for; the oldest goes first. */
export const PRONOUNCE_BOOKS_MAX = 100;

const tidy = (s: string) => s.trim().replace(/\s+/g, " ");

/** Why a word and its respelling can't be kept, or null when they can. */
export function pronunciationError(word: string, say: string, existing: Pronunciations = {}): string | null {
  const w = tidy(word);
  const s = tidy(say);
  if (!w) return tr("Type the name or word as the book writes it.");
  if (!s) return tr("Type how it sounds.");
  if (w.length > PRONOUNCE_WORD_MAX) return tr("Keep the word to {n} characters.", { n: PRONOUNCE_WORD_MAX });
  if (s.length > PRONOUNCE_SAY_MAX) return tr("Keep how it sounds to {n} characters.", { n: PRONOUNCE_SAY_MAX });
  if (w.toLowerCase() === s.toLowerCase()) return tr("Spell how it sounds differently from the word.");
  if (!validPronunciation(w, s)) return tr("Use letters, with spaces, hyphens or apostrophes between them.");
  const others = Object.keys(existing).filter((k) => k.toLowerCase() !== w.toLowerCase());
  if (others.length >= PRONUNCIATIONS_MAX) return tr("A book can have up to {n} pronunciations.", { n: PRONUNCIATIONS_MAX });
  return null;
}

/** All of a profile's pronunciations with one word's respelling set (null to remove it). */
export function withPronunciation(all: Record<string, Pronunciations> | undefined, bookId: string, word: string, say: string | null): Record<string, Pronunciations> {
  const next = { ...(all ?? {}) };
  const book: Pronunciations = {};
  const w = tidy(word);
  for (const [k, v] of Object.entries(next[bookId] ?? {})) if (k.toLowerCase() !== w.toLowerCase()) book[k] = v;
  if (say !== null && Object.keys(book).length < PRONUNCIATIONS_MAX) book[w] = tidy(say);
  delete next[bookId];
  const parsed = parsePronunciations(book);
  if (Object.keys(parsed).length) next[bookId] = parsed;
  const ids = Object.keys(next);
  for (const id of ids.slice(0, Math.max(0, ids.length - PRONOUNCE_BOOKS_MAX))) delete next[id];
  return next;
}

/** Pronunciations read back from the database: books with valid ones only. */
export function parseAllPronunciations(value: unknown): Record<string, Pronunciations> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, Pronunciations> = {};
  for (const [bookId, pron] of Object.entries(value as Record<string, unknown>).slice(-PRONOUNCE_BOOKS_MAX)) {
    const parsed = parsePronunciations(pron);
    if (bookId.length <= 64 && Object.keys(parsed).length) out[bookId] = parsed;
  }
  return out;
}
