/**
 * Time left: how long the rest of a chapter or book takes this profile. Reading uses the
 * profile's own pace in words a minute, learnt from how long it stays on each page (a page
 * glanced at or left open is ignored); listening uses the recording's time at the player's speed.
 */
export const DEFAULT_WPM = 230;
export const MIN_WPM = 60;
export const MAX_WPM = 1000;

export function countWords(paragraphs: string[]): number {
  let n = 0;
  for (const p of paragraphs) n += p.split(/\s+/).filter(Boolean).length;
  return n;
}

/** Words a minute from one page: null when the page was too short, glanced at or left open. */
export function pageSample(words: number, seconds: number): number | null {
  if (words < 40 || seconds < 4 || seconds > 600) return null;
  const wpm = (words * 60) / seconds;
  return wpm >= MIN_WPM && wpm <= MAX_WPM ? wpm : null;
}

/** The pace so far, moved a fifth of the way towards a new page's. */
export function blendPace(current: number | null, sample: number): number {
  const next = current === null ? sample : current * 0.8 + sample * 0.2;
  return Math.round(Math.min(MAX_WPM, Math.max(MIN_WPM, next)));
}

/** "under a minute", "about 12 min", "about 3 h 5 min". */
export function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `about ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `about ${h} h${m ? ` ${m} min` : ""}`;
}

export function readingSecondsLeft(words: number, wpm: number | null): number {
  return (Math.max(0, words) / (wpm ?? DEFAULT_WPM)) * 60;
}

export function listeningSecondsLeft(seconds: number, speed: number): number {
  return Math.max(0, seconds) / (speed > 0 ? speed : 1);
}
