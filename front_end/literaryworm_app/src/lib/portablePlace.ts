/**
 * Listening together on a club that reads an uploaded book (components/ListenAlong.tsx): each
 * member hears their own copy, whose chapters may not last the same time as anyone else's, so the
 * session keeps a place that carries over: the chapter's index plus how far through it (0–1), as
 * one number (3.42 is 42% through the fourth chapter). Each member turns it into seconds in their
 * own copy.
 */

/** The portable place for `seconds` into a book whose chapters start at `starts` and last `lengths`. */
export function toPortable(seconds: number, starts: number[], lengths: number[]): number {
  if (!starts.length) return 0;
  let c = 0;
  for (let i = 0; i < starts.length; i++) if (seconds >= starts[i]) c = i;
  const share = lengths[c] ? (seconds - starts[c]) / lengths[c] : 0;
  return c + Math.min(0.9999, Math.max(0, share));
}

/** Seconds into this copy for a portable place (a chapter past this copy's end goes to its end). */
export function fromPortable(place: number, starts: number[], lengths: number[]): number {
  if (!starts.length) return 0;
  const c = Math.floor(Math.max(0, place));
  if (c >= starts.length) return starts[starts.length - 1] + (lengths[lengths.length - 1] ?? 0);
  return starts[c] + (place - c) * (lengths[c] ?? 0);
}

/** Chapter starts and lengths in seconds, as the player times a book (lib/reading.ts chapterTimes). */
export function bookTimes(book: { chapters: { minutes: number }[] }): { starts: number[]; lengths: number[] } {
  const starts: number[] = [];
  const lengths: number[] = [];
  let total = 0;
  for (const c of book.chapters) {
    starts.push(total);
    lengths.push(c.minutes * 60);
    total += c.minutes * 60;
  }
  return { starts, lengths };
}

/**
 * Where a session is now, in seconds into this copy: a portable place is turned into this copy's
 * seconds first, then the time since it was heard is added if it's playing.
 */
export function sessionSeconds(
  session: { position: number; playing: boolean; rate: number; heardAt: number },
  times: { starts: number[]; lengths: number[] } | null,
  now = Date.now(),
): number {
  const at = times ? fromPortable(session.position, times.starts, times.lengths) : session.position;
  return session.playing ? at + ((now - session.heardAt) / 1000) * session.rate : at;
}
