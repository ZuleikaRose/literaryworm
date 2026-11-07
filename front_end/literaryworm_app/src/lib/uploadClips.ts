import { CLIP_LENGTHS, type ClipLength, CLIP_MIN } from "./clips";
import { naturalVoice } from "./naturalVoice";

/**
 * Audio quotes from uploads: a short stretch of one natural-voice part of a member's own upload,
 * shared as a link (`/clips/u-…?c=<chapter>&p=<part>&a=<place in the part, 0–1000>&l=<seconds>&v=<voice>&x=<1 with
 * character voices>`). Nothing is cut, uploaded or stored: the clip page asks the natural-voice
 * function for that part like the player does, and the function only answers the account that
 * owns the upload, so the link plays only for that household (the demo plays its recordings).
 */
export interface UploadClip {
  chapter: number;
  /** The part (piece) of the chapter, as chapterPieces() cuts it. */
  piece: number;
  /** Where in the part the listener was, in thousandths. */
  at: number;
  length: ClipLength;
  voice: string;
  cast: boolean;
}

/** The clip for a place `share` (0–1) through a chapter cut into `pieces`: the part heard there. */
export function uploadClipAt(chapter: number, share: number, pieces: { offset: number; text: string }[], length: ClipLength, voice: string, cast: boolean): UploadClip | null {
  const last = pieces.at(-1);
  if (!last) return null;
  const size = last.offset + last.text.length;
  const char = Math.max(0, Math.min(size - 1, Math.round(share * size)));
  const piece = Math.max(0, pieces.findIndex((p) => char >= p.offset && char < p.offset + p.text.length));
  const p = pieces[piece];
  const at = Math.round(((char - p.offset) / Math.max(1, p.text.length)) * 1000);
  return { chapter, piece, at: Math.max(0, Math.min(1000, at)), length, voice, cast };
}

/** The clip's address on this site. */
export const uploadClipPath = (uploadId: string, c: UploadClip) =>
  `/clips/${encodeURIComponent(uploadId)}?c=${c.chapter}&p=${c.piece}&a=${c.at}&l=${c.length}&v=${encodeURIComponent(c.voice)}&x=${c.cast ? 1 : 0}`;

/** Reads an upload clip from the address, or null when it isn't a well-formed one. */
export function readUploadClip(params: URLSearchParams): UploadClip | null {
  const num = (k: string, max: number) => {
    const v = params.get(k);
    return v !== null && /^\d{1,4}$/.test(v) && Number(v) <= max ? Number(v) : null;
  };
  const chapter = num("c", 499);
  const piece = num("p", 9999);
  const at = num("a", 1000);
  const length = num("l", 60);
  const voice = params.get("v") ?? "";
  const x = params.get("x");
  if (chapter === null || piece === null || at === null || length === null) return null;
  if (!(CLIP_LENGTHS as readonly number[]).includes(length) || !naturalVoice(voice) || (x !== "0" && x !== "1")) return null;
  return { chapter, piece, at, length: length as ClipLength, voice, cast: x === "1" };
}

/** The seconds of the part's audio to play: the `length` heard up to the place, or ahead of it near the part's start. */
export function uploadClipWindow(at: number, length: number, duration: number): { start: number; end: number } {
  const place = (at / 1000) * duration;
  let start = Math.max(0, place - length);
  let end = place;
  if (end - start < CLIP_MIN) {
    start = place;
    end = Math.min(duration, place + length);
  }
  // A part shorter than the clip: all of it.
  if (end - start < CLIP_MIN) {
    start = 0;
    end = duration;
  }
  return { start, end };
}
