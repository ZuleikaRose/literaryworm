// On-device natural voices: Piper voices (VITS, ONNX) run in the browser by lib/onDeviceEngine.ts,
// with the English pronunciation of @piper-plus/g2p (MIT; CMU Pronouncing Dictionary), so no
// eSpeak (GPL) and nothing sent anywhere. The models are downloaded once from our own Storage
// (the public `voice-models` bucket, served at /voice-models/) and kept in the `lw-voices` cache.
// This file is the rules only (no ONNX), so it can be tested.

/** One on-device voice. Every voice here is US English; its dataset licence allows any use. */
export interface OnDeviceVoice {
  id: string;
  /** What the menu calls it. */
  name: string;
  gender: "woman" | "man";
  /** The model file in the `voice-models` bucket (its config is the same name + ".json"). */
  file: string;
  /** The model's size, for "about N MB". */
  bytes: number;
  /** The model is stored in this many parts (`<file>.0`, `.1`…), each under Storage's 50 MB upload limit. */
  parts: number;
  /** Where the voice comes from (Help and humans.txt credit it). */
  credit: string;
}

export const ON_DEVICE_VOICES: readonly OnDeviceVoice[] = [
  {
    id: "ljspeech",
    name: "Linda",
    gender: "woman",
    file: "en_US-ljspeech-medium.onnx",
    bytes: 63_531_379,
    parts: 2,
    credit: "LJ Speech Dataset (public domain); Piper voice by Bryce Beattie (MIT)",
  },
  {
    id: "norman",
    name: "Norman",
    gender: "man",
    file: "en_US-norman-medium.onnx",
    bytes: 63_531_379,
    parts: 2,
    credit: "LibriVox recordings (public domain); Piper voice (MIT)",
  },
];

/** ProfileData.narrationVoice for an on-device voice: this prefix and its id. */
export const ON_DEVICE_PREFIX = "ondevice:";

/** The cache the models are kept in on the device (the Cookie Policy names it). */
export const ON_DEVICE_CACHE = "lw-voices";

/** Where a voice's whole model is kept in the device's cache, and its config is served. */
export const modelPath = (voice: OnDeviceVoice, config = false) => `/voice-models/${voice.file}${config ? ".json" : ""}`;

/** Where each part of a voice's model is served (vercel.json and Vite's dev proxy send them to the bucket). */
export const modelPartPaths = (voice: OnDeviceVoice) => Array.from({ length: voice.parts }, (_, i) => `/voice-models/${voice.file}.${i}`);

/** Bytes in each stored part but the last (supabase/upload-voice-models.sh cuts at this size). */
export const MODEL_PART_BYTES = 40 * 1024 * 1024;

export const onDeviceVoice = (id: string): OnDeviceVoice | null => ON_DEVICE_VOICES.find((v) => v.id === id) ?? null;

/** The voice a narrationVoice value names, or null. */
export function onDeviceChoice(choice: string | null): OnDeviceVoice | null {
  return choice?.startsWith(ON_DEVICE_PREFIX) ? onDeviceVoice(choice.slice(ON_DEVICE_PREFIX.length)) : null;
}

/** English, as a catalog book (no language, or "English") or an upload ("en", "en-GB") says it. */
export function isEnglish(language: string | null | undefined): boolean {
  return !language || /^(en|eng)([-_].*)?$/i.test(language) || /^english$/i.test(language);
}

/**
 * Whether the on-device voices are offered: members (any profile, Kids too: nothing is sent or
 * kept anywhere but the device), for a book in English. Not the demo or visitors, so the models
 * (about 64 MB each) are only downloaded for accounts.
 */
export function onDeviceOffered({ member, language }: { member: boolean; language: string | null | undefined }): boolean {
  return member && isEnglish(language);
}

/** The most characters in one piece: about 20 seconds of reading, voiced in a few seconds. */
export const DEVICE_PIECE_CHARS = 280;

// After a sentence's end (with any closing quotes or brackets) and its spaces, or at a line break.
const BREAK = /[.!?…;:]["'”’)\]]*\s+|\n\s*/g;

/**
 * A chapter cut into the pieces an on-device voice reads: whole sentences up to DEVICE_PIECE_CHARS
 * (shorter than a Google piece, so the first one plays soon), a longer sentence at a space.
 */
export function devicePieces(chapter: string): { offset: number; text: string }[] {
  const breaks: number[] = [];
  for (const m of chapter.matchAll(BREAK)) breaks.push((m.index ?? 0) + m[0].length);
  const pieces: { offset: number; text: string }[] = [];
  let start = 0;
  let b = 0;
  while (start < chapter.length) {
    while (start < chapter.length && /\s/.test(chapter[start])) start++;
    if (start >= chapter.length) break;
    let end = chapter.length;
    if (chapter.length - start > DEVICE_PIECE_CHARS) {
      const limit = start + DEVICE_PIECE_CHARS;
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
    if (text) pieces.push({ offset: start, text });
    start = end;
  }
  return pieces;
}

/** 16-bit mono PCM WAV of `samples` (-1 to 1) at `rate`. */
export function wavBytes(samples: ArrayLike<number>, rate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(out.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return out;
}

/**
 * Piper's phoneme ids for IPA tokens, laid out as @piper-plus/g2p's Encoder does: the start mark,
 * each character's id and a pad after it (a character the voice doesn't know is just the pad), the end mark.
 */
export function phonemeIds(tokens: string[], map: Record<string, number[]>): number[] {
  const pad = map._?.[0] ?? 0;
  const ids: number[] = [map["^"]?.[0] ?? 1];
  for (const ch of tokens.flatMap((t) => [...t])) {
    const found = map[ch];
    if (found) ids.push(...found);
    ids.push(pad);
  }
  ids.push(map.$?.[0] ?? 2);
  return ids;
}
