/**
 * Audio quote clips: a short stretch of a LibriVox recording, shared as a link
 * (`/clips/:bookId?c=<chapter>&s=<start>&e=<end>`, seconds into that chapter's track). Nothing is
 * cut or uploaded: the clip page streams the public-domain MP3 from the Internet Archive and plays
 * only that stretch. Made from the player's place: the seconds just heard, or the ones ahead at
 * the very start of a chapter.
 */
export const CLIP_LENGTHS = [15, 30, 60] as const;
export type ClipLength = (typeof CLIP_LENGTHS)[number];
export const CLIP_MIN = 5;
export const CLIP_MAX = 60;

export interface Clip {
  chapterIndex: number;
  /** Seconds into the chapter's track. */
  start: number;
  end: number;
}

/** The clip ending at `offset` seconds into the chapter (or starting there when too little was heard). */
export function clipAt(chapterIndex: number, offset: number, length: ClipLength, trackSeconds: number): Clip {
  const at = Math.max(0, Math.min(Math.round(offset), Math.round(trackSeconds)));
  let start = Math.max(0, at - length);
  let end = at;
  if (end - start < CLIP_MIN) {
    start = at;
    end = Math.min(Math.round(trackSeconds), at + length);
  }
  return { chapterIndex, start, end };
}

/** The clip's address on this site. */
export const clipPath = (bookId: string, c: Clip) => `/clips/${encodeURIComponent(bookId)}?c=${c.chapterIndex}&s=${c.start}&e=${c.end}`;

/** Reads a clip from the address, or null when it isn't one a recording with `tracks` can play. */
export function readClip(params: URLSearchParams, trackSeconds: number[]): Clip | null {
  const num = (k: string) => {
    const v = params.get(k);
    return v !== null && /^\d{1,6}$/.test(v) ? Number(v) : null;
  };
  const chapterIndex = num("c");
  const start = num("s");
  const end = num("e");
  if (chapterIndex === null || start === null || end === null) return null;
  if (chapterIndex >= trackSeconds.length) return null;
  const length = end - start;
  if (length < CLIP_MIN || length > CLIP_MAX || end > Math.ceil(trackSeconds[chapterIndex]) + 1) return null;
  return { chapterIndex, start, end };
}

/** 75 → "1:15". */
export function clipTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}
