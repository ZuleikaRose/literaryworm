import { tk, tr } from "./i18n";
import type { BookMood, Mood, Pace } from "../types";

/**
 * Moods and pace: how a book felt to one profile (StoryGraph's moods, so its export and ours line
 * up). Per profile in `book_moods` (migration 6604), saved first like ratings; up to three moods a
 * book. My Library filters by mood (?mood=), and the *Feel-good picks* smart list uses them.
 */
export const MOODS: { value: Mood; label: string }[] = [
  { value: "adventurous", label: tk("Adventurous") },
  { value: "challenging", label: tk("Challenging") },
  { value: "dark", label: tk("Dark") },
  { value: "emotional", label: tk("Emotional") },
  { value: "funny", label: tk("Funny") },
  { value: "hopeful", label: tk("Hopeful") },
  { value: "informative", label: tk("Informative") },
  { value: "inspiring", label: tk("Inspiring") },
  { value: "lighthearted", label: tk("Lighthearted") },
  { value: "mysterious", label: tk("Mysterious") },
  { value: "reflective", label: tk("Reflective") },
  { value: "relaxing", label: tk("Relaxing") },
  { value: "sad", label: tk("Sad") },
  { value: "tense", label: tk("Tense") },
];

export const PACES: { value: Pace; label: string }[] = [
  { value: "slow", label: tk("Slow") },
  { value: "medium", label: tk("Medium") },
  { value: "fast", label: tk("Fast") },
];

/** At most this many moods a book (the database checks it too). */
export const MOODS_MAX = 3;

/** The moods the Feel-good picks smart list looks for. */
export const FEEL_GOOD: readonly Mood[] = ["funny", "hopeful", "lighthearted", "relaxing", "inspiring"];

const MOOD_VALUES = new Set<string>(MOODS.map((m) => m.value));
export const isMood = (value: string | null | undefined): value is Mood => Boolean(value && MOOD_VALUES.has(value));
export const moodLabel = (mood: Mood) => MOODS.find((m) => m.value === mood)?.label ?? mood;
export const paceLabel = (pace: Pace) => PACES.find((p) => p.value === pace)?.label ?? pace;

/** Turns a mood on or off; a fourth isn't added (null: the caller says why). Kept in MOODS order. */
export function toggleMood(moods: Mood[], mood: Mood): Mood[] | null {
  if (moods.includes(mood)) return moods.filter((m) => m !== mood);
  if (moods.length >= MOODS_MAX) return null;
  const next = new Set([...moods, mood]);
  return MOODS.map((m) => m.value).filter((m) => next.has(m));
}

/** Nothing tagged: no moods and no pace (the row is removed). */
export const isEmptyMood = (m: BookMood | null | undefined) => !m || (m.moods.length === 0 && m.pace === null);

/** "Funny, hopeful · Fast", for a list row or an export. */
export function moodSummary(m: BookMood | null | undefined): string {
  if (isEmptyMood(m)) return "";
  const moods = m!.moods.map((x) => tr(moodLabel(x)).toLowerCase()).join(", ");
  const words = moods ? moods[0].toUpperCase() + moods.slice(1) : "";
  return [words, m!.pace ? tr("{pace} pace", { pace: tr(paceLabel(m!.pace)) }) : ""].filter(Boolean).join(" · ");
}
