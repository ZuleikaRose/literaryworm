// On-device natural voices: Piper voices (VITS, ONNX) run in the browser by lib/onDeviceEngine.ts,
// with the English pronunciation of @piper-plus/g2p (MIT; CMU Pronouncing Dictionary), so no
// eSpeak (GPL) and nothing sent anywhere. The models are downloaded once from our own Storage
// (the public `voice-models` bucket, served at /voice-models/) and kept in the `lw-voices` cache.
// This file is the rules only (no ONNX), so it can be tested.

/** The English accents the on-device voices have, in the order the Voice menu lists them. */
export const ON_DEVICE_ACCENTS = ["American", "British", "Scottish", "Irish", "Canadian", "Australian", "New Zealand", "South African"] as const;
export type OnDeviceAccent = (typeof ON_DEVICE_ACCENTS)[number];

/** One on-device voice. Every dataset here allows any use (CC BY ones are credited in Help and humans.txt). */
export interface OnDeviceVoice {
  id: string;
  /** What the menu calls it: a single voice's own name, or a dataset speaker's place (and code). */
  name: string;
  gender: "woman" | "man" | "non-binary";
  accent: OnDeviceAccent;
  /** The model file in the `voice-models` bucket (its config is the same name + ".json"). */
  file: string;
  /** The model's size, for "about N MB". */
  bytes: number;
  /** The model is stored in this many parts (`<file>.0`, `.1`…), each under Storage's 50 MB upload limit. */
  parts: number;
  /** For a model of many speakers (VCTK, CMU ARCTIC): which one, by its name in the model's speaker_id_map. */
  speaker?: string;
  /** Where the recordings come from; the voices themselves are Piper's (MIT). */
  credit: string;
}

/** 39 voices from 16 Piper models (VCTK's and ARCTIC's speakers share one model each). */
export const ON_DEVICE_VOICES: readonly OnDeviceVoice[] = [
  { id: "ljspeech", name: "Linda", gender: "woman", accent: "American", file: "en_US-ljspeech-medium.onnx", bytes: 63_531_379, parts: 2, credit: "LJ Speech Dataset (public domain)" },
  { id: "kristin", name: "Kristin", gender: "woman", accent: "American", file: "en_US-kristin-medium.onnx", bytes: 63_531_379, parts: 2, credit: "LibriVox recordings (public domain)" },
  { id: "kathleen", name: "Kathleen", gender: "woman", accent: "American", file: "en_US-kathleen-medium.onnx", bytes: 63_221_984, parts: 2, credit: "Kathleen voice dataset (CC0)" },
  { id: "hifi92", name: "Hi-Fi 92", gender: "woman", accent: "American", file: "en_US-hifi_tts_92-medium.onnx", bytes: 63_221_984, parts: 2, credit: "Hi-Fi Multi-Speaker English TTS Dataset by NVIDIA (CC BY 4.0)" },
  { id: "arctic-slt", name: "Arctic SLT", gender: "woman", accent: "American", file: "en_US-arctic-medium.onnx", bytes: 76_786_611, parts: 2, speaker: "slt", credit: "CMU ARCTIC, Carnegie Mellon University (CMU licence)" },
  { id: "arctic-clb", name: "Arctic CLB", gender: "woman", accent: "American", file: "en_US-arctic-medium.onnx", bytes: 76_786_611, parts: 2, speaker: "clb", credit: "CMU ARCTIC, Carnegie Mellon University (CMU licence)" },
  { id: "norman", name: "Norman", gender: "man", accent: "American", file: "en_US-norman-medium.onnx", bytes: 63_531_379, parts: 2, credit: "LibriVox recordings (public domain)" },
  { id: "john", name: "John", gender: "man", accent: "American", file: "en_US-john-medium.onnx", bytes: 63_531_379, parts: 2, credit: "LibriVox recordings (public domain)" },
  { id: "bryce", name: "Bryce", gender: "man", accent: "American", file: "en_US-bryce-medium.onnx", bytes: 63_531_379, parts: 2, credit: "Recorded by Bryce Beattie (public domain)" },
  { id: "joe", name: "Joe", gender: "man", accent: "American", file: "en_US-joe-medium.onnx", bytes: 63_221_984, parts: 2, credit: "Open Home Foundation voice datasets (CC0)" },
  { id: "mike", name: "Mike", gender: "man", accent: "American", file: "en_US-mike-medium.onnx", bytes: 63_221_984, parts: 2, credit: "Open Home Foundation voice datasets (CC0)" },
  { id: "arctic-bdl", name: "Arctic BDL", gender: "man", accent: "American", file: "en_US-arctic-medium.onnx", bytes: 76_786_611, parts: 2, speaker: "bdl", credit: "CMU ARCTIC, Carnegie Mellon University (CMU licence)" },
  { id: "arctic-rms", name: "Arctic RMS", gender: "man", accent: "American", file: "en_US-arctic-medium.onnx", bytes: 76_786_611, parts: 2, speaker: "rms", credit: "CMU ARCTIC, Carnegie Mellon University (CMU licence)" },
  { id: "sam", name: "Sam", gender: "non-binary", accent: "American", file: "en_US-sam-medium.onnx", bytes: 63_221_984, parts: 2, credit: "Sam, the non-binary voice by Accenture (Apache 2.0)" },
  { id: "cori", name: "Cori", gender: "woman", accent: "British", file: "en_GB-cori-medium.onnx", bytes: 63_221_984, parts: 2, credit: "Hi-Fi Multi-Speaker English TTS Dataset by NVIDIA (CC BY 4.0)" },
  { id: "southern-english", name: "Southern English", gender: "woman", accent: "British", file: "en_GB-southern_english_female-low.onnx", bytes: 63_104_526, parts: 2, credit: "Google's crowdsourced UK and Ireland English dataset, OpenSLR 83 (CC BY-SA 4.0)" },
  { id: "vctk-p225", name: "Southern England (p225)", gender: "woman", accent: "British", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p225", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p228", name: "Southern England (p228)", gender: "woman", accent: "British", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p228", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "northern-english", name: "Northern English", gender: "man", accent: "British", file: "en_GB-northern_english_male-medium.onnx", bytes: 63_221_984, parts: 2, credit: "Google's crowdsourced UK and Ireland English dataset, OpenSLR 83 (CC BY-SA 4.0)" },
  { id: "vctk-p226", name: "Surrey (p226)", gender: "man", accent: "British", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p226", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p232", name: "Southern England (p232)", gender: "man", accent: "British", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p232", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p243", name: "London (p243)", gender: "man", accent: "British", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p243", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "alba", name: "Alba", gender: "woman", accent: "Scottish", file: "en_GB-alba-medium.onnx", bytes: 63_221_984, parts: 2, credit: "Alba speech corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "arctic-awb", name: "Arctic AWB", gender: "man", accent: "Scottish", file: "en_US-arctic-medium.onnx", bytes: 76_786_611, parts: 2, speaker: "awb", credit: "CMU ARCTIC, Carnegie Mellon University (CMU licence)" },
  { id: "vctk-p252", name: "Edinburgh (p252)", gender: "man", accent: "Scottish", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p252", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p288", name: "Dublin (p288)", gender: "woman", accent: "Irish", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p288", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p245", name: "Dublin (p245)", gender: "man", accent: "Irish", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p245", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p303", name: "Toronto (p303)", gender: "woman", accent: "Canadian", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p303", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p317", name: "Hamilton (p317)", gender: "woman", accent: "Canadian", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p317", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p343", name: "Alberta (p343)", gender: "woman", accent: "Canadian", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p343", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p363", name: "Toronto (p363)", gender: "man", accent: "Canadian", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p363", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p316", name: "Alberta (p316)", gender: "man", accent: "Canadian", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p316", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p302", name: "Montreal (p302)", gender: "man", accent: "Canadian", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p302", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "arctic-jmk", name: "Arctic JMK", gender: "man", accent: "Canadian", file: "en_US-arctic-medium.onnx", bytes: 76_786_611, parts: 2, speaker: "jmk", credit: "CMU ARCTIC, Carnegie Mellon University (CMU licence)" },
  { id: "vctk-p326", name: "Sydney (p326)", gender: "man", accent: "Australian", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p326", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p374", name: "The Outback (p374)", gender: "man", accent: "Australian", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p374", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p335", name: "New Zealand (p335)", gender: "woman", accent: "New Zealand", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p335", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p314", name: "Cape Town (p314)", gender: "woman", accent: "South African", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p314", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
  { id: "vctk-p347", name: "Johannesburg (p347)", gender: "man", accent: "South African", file: "en_GB-vctk-medium.onnx", bytes: 76_972_979, parts: 2, speaker: "p347", credit: "CSTR VCTK Corpus, University of Edinburgh (CC BY 4.0)" },
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
 * Whether the on-device voices are offered: members and the demo (any profile, Kids too: nothing is
 * sent or kept anywhere but the device), for a book in English. Not visitors who aren't trying the
 * demo, so the models (about 63 to 77 MB each) are only downloaded by someone listening.
 */
export function onDeviceOffered({ member, language }: { member: boolean; language: string | null | undefined }): boolean {
  return member && isEnglish(language);
}

/**
 * The models the demo offers: Linda, Norman and the VCTK speakers (every accent but one model), so a
 * visitor trying the demo downloads at most three models from our storage, usually one. Members get
 * all of ON_DEVICE_VOICES.
 */
export const DEMO_ON_DEVICE_FILES: readonly string[] = ["en_US-ljspeech-medium.onnx", "en_US-norman-medium.onnx", "en_GB-vctk-medium.onnx"];

/** The on-device voices offered: none unless `offered`; the demo's three models' voices; else all of them. */
export function offeredOnDeviceVoices({ offered, demo }: { offered: boolean; demo: boolean }): readonly OnDeviceVoice[] {
  if (!offered) return [];
  return demo ? ON_DEVICE_VOICES.filter((v) => DEMO_ON_DEVICE_FILES.includes(v.file)) : ON_DEVICE_VOICES;
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
