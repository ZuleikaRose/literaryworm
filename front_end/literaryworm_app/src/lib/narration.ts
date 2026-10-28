import { useEffect, useState } from "react";
import { samplePageSentences } from "../data/sampleText";
import type { Book, RecordingTrack } from "../types";
import { readerPages } from "./reading";

/**
 * Who reads an audiobook aloud. The playback engine (components/PlaybackProvider.tsx) keeps the
 * clock, sleep timer, limits and saving; a narrator only makes the sound and says where it is.
 * Two kinds: a book's LibriVox recording, and the device's own voices reading the text.
 */

export interface NarratorEvents {
  /** The chapter at `index` has been read to its end. */
  onChapterEnd: (index: number) => void;
  /** Waiting for audio to load. */
  onWaiting: () => void;
  onPlaying: () => void;
  /** Stopped for good after a failure; `message` is for the listener. */
  onError: (message: string) => void;
}

export interface Narrator {
  /** Puts the narration at `seconds` into the book. */
  cue: (seconds: number) => void;
  /** Starts reading; call it inside the click that asked for it, or browsers may block it. */
  start: () => void;
  stop: () => void;
  isPlaying: () => boolean;
  /** Seconds into the book, or null until something is cued. */
  position: () => number | null;
  setRate: (rate: number) => void;
  dispose: () => void;
}

export const LIBRIVOX_VOICE = "librivox";
export const SILENT_VOICE = "silent";

export type Narration = { kind: "recording" } | { kind: "speech"; voice: SpeechSynthesisVoice } | { kind: "silent" };

/**
 * Who reads `book` for a profile's choice (ProfileData.narrationVoice) on this device. The
 * recording is the default where there is one; a voice the device doesn't have falls back to the
 * default; with no voices at all, the sample clock runs silently.
 */
export function resolveNarration(book: Book, choice: string | null, voices: SpeechSynthesisVoice[]): Narration {
  if (choice === SILENT_VOICE && !book.recording) return { kind: "silent" };
  const chosen = choice ? voices.find((v) => v.voiceURI === choice) : undefined;
  if (chosen) return { kind: "speech", voice: chosen };
  if (book.recording) return { kind: "recording" };
  const fallback = defaultVoice(voices);
  return fallback ? { kind: "speech", voice: fallback } : { kind: "silent" };
}

/** The book's LibriVox recording: one audio element playing one chapter's track at a time. */
export function recordingNarrator(tracks: RecordingTrack[], starts: number[], events: NarratorEvents): Narrator {
  const audio = new Audio();
  audio.preload = "auto";
  let loaded = -1;
  let retried = false;

  const chapterAt = (seconds: number) => starts.reduce((found, start, i) => (seconds >= start ? i : found), 0);
  const cue = (seconds: number) => {
    const index = chapterAt(seconds);
    if (loaded !== index) {
      audio.src = tracks[index].url;
      loaded = index;
    }
    // Before the track's metadata loads this sets where it starts.
    audio.currentTime = Math.max(0, seconds - starts[index]);
  };
  const start = () => {
    audio.play().catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return; // a pause or a new track interrupted it
      events.onError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Press play to start the narration."
          : "We couldn't play the narration. Check your connection, then press play to try again.",
      );
    });
  };

  const onEnded = () => events.onChapterEnd(loaded);
  const onWaiting = () => events.onWaiting();
  const onPlaying = () => {
    retried = false;
    events.onPlaying();
  };
  const onError = () => {
    if (loaded < 0) return;
    const at = starts[loaded] + (Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    loaded = -1;
    // The Internet Archive sometimes fails a request; one quiet retry usually fixes it.
    if (!retried) {
      retried = true;
      cue(at);
      start();
      return;
    }
    events.onError("We couldn't load the narration. Check your connection, then press play to try again.");
  };
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("waiting", onWaiting);
  audio.addEventListener("playing", onPlaying);
  audio.addEventListener("error", onError);

  return {
    cue,
    start,
    stop: () => audio.pause(),
    isPlaying: () => !audio.paused,
    position: () => (loaded < 0 ? null : starts[loaded] + audio.currentTime),
    setRate: (rate) => {
      audio.defaultPlaybackRate = rate;
      audio.playbackRate = rate;
    },
    dispose: () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}

/** About how many characters a voice reads a second at 1×, to move the clock between sentences. */
const CHARS_PER_SECOND = 14;
/** Long sentences are spoken in parts: some browsers cut off a long utterance. */
const MAX_PART = 220;

interface Part {
  text: string;
  /** Characters before it in its chapter. */
  offset: number;
}

/** A chapter's text in the pieces a voice speaks: sentences, long ones split at commas. */
function speakingParts(text: string): Part[] {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?…]+(?:[.!?…]+["”’)]*\s*|$)/g) ?? [];
  const parts: Part[] = [];
  let offset = 0;
  for (const sentence of sentences) {
    let rest = sentence;
    while (rest.length > MAX_PART) {
      const cut = Math.max(rest.lastIndexOf(", ", MAX_PART), rest.lastIndexOf("; ", MAX_PART), rest.lastIndexOf(" ", MAX_PART));
      const piece = rest.slice(0, cut > 0 ? cut + 1 : MAX_PART);
      parts.push({ text: piece, offset });
      offset += piece.length;
      rest = rest.slice(piece.length);
    }
    if (rest.trim()) parts.push({ text: rest, offset });
    offset += rest.length;
  }
  return parts;
}

/** The device's voice reading `chapters` (one text each), timed to the book's chapter lengths. */
export function speechNarrator(
  chapters: string[],
  starts: number[],
  lengths: number[],
  voice: SpeechSynthesisVoice,
  events: NarratorEvents,
): Narrator {
  const synth = window.speechSynthesis;
  const parts = chapters.map(speakingParts);
  const sizes = chapters.map((_, i) => {
    const last = parts[i][parts[i].length - 1];
    return last ? last.offset + last.text.length : 1;
  });
  let chapter = 0;
  let part = 0;
  let rate = 1;
  let speaking = false;
  let spokenFrom = 0; // when the current part started, for the clock between sentences
  let generation = 0; // utterances from before a stop or a cue are ignored
  let cued = false;

  const charsDone = () => {
    const current = parts[chapter][part];
    if (!current) return sizes[chapter];
    const inPart = speaking ? Math.min(current.text.length, ((performance.now() - spokenFrom) / 1000) * CHARS_PER_SECOND * rate) : 0;
    return current.offset + inPart;
  };

  const speakPart = () => {
    const mine = ++generation;
    const current = parts[chapter][part];
    if (!current) {
      speaking = false;
      events.onChapterEnd(chapter);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(current.text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = rate;
    utterance.onstart = () => {
      if (mine !== generation) return;
      spokenFrom = performance.now();
      events.onPlaying();
    };
    utterance.onend = () => {
      if (mine !== generation || !speaking) return;
      part += 1;
      speakPart();
    };
    utterance.onerror = (e) => {
      if (mine !== generation || e.error === "interrupted" || e.error === "canceled") return;
      speaking = false;
      events.onError(
        e.error === "not-allowed" ? "Press play to start the narration." : "This voice stopped working. Try another voice from the list.",
      );
    };
    spokenFrom = performance.now();
    synth.speak(utterance);
  };

  const stop = () => {
    if (speaking) {
      // Keep the place: the next start begins at the part that was being read.
      speaking = false;
      generation += 1;
      synth.cancel();
    }
  };

  return {
    cue: (seconds) => {
      const wasSpeaking = speaking;
      stop();
      cued = true;
      chapter = starts.reduce((found, start, i) => (seconds >= start ? i : found), 0);
      const target = (Math.max(0, seconds - starts[chapter]) / lengths[chapter]) * sizes[chapter];
      const index = parts[chapter].findIndex((p) => p.offset + p.text.length > target);
      part = index < 0 ? parts[chapter].length : index;
      if (wasSpeaking) {
        speaking = true;
        speakPart();
      }
    },
    start: () => {
      if (speaking) return;
      speaking = true;
      // Chrome can leave the queue paused after a long idle; clear it before speaking.
      synth.cancel();
      speakPart();
    },
    stop,
    isPlaying: () => speaking,
    position: () => (cued ? starts[chapter] + (charsDone() / sizes[chapter]) * lengths[chapter] : null),
    setRate: (next) => {
      rate = next;
      // Takes effect from the next sentence; restarting this one would repeat words.
    },
    dispose: () => {
      stop();
      generation += 1;
    },
  };
}

const textCache = new Map<string, Promise<string[]>>();

/**
 * What a voice reads for each chapter: the full public-domain text where the book has a
 * recording (public/texts, from Project Gutenberg), otherwise the reader's sample text.
 */
export function bookText(book: Book): Promise<string[]> {
  let text = textCache.get(book.id);
  if (!text) {
    text = book.recording
      ? fetch(`/texts/${book.id}.json`).then(async (res) => {
          if (!res.ok) throw new Error("We couldn't load this book's text. Try again.");
          return ((await res.json()) as { chapters: string[] }).chapters;
        })
      : Promise.resolve(
          book.chapters.map((_, chapterIndex) =>
            readerPages(book)
              .filter((p) => p.chapterIndex === chapterIndex)
              .flatMap((p) => samplePageSentences(book.id, chapterIndex, p.page, "en").map((paragraph) => paragraph.join(" ")))
              .join("\n\n"),
          ),
        );
    text.catch(() => textCache.delete(book.id));
    textCache.set(book.id, text);
  }
  return text;
}

export type Accent = "British" | "American" | "Australian";

const ACCENTS: Record<string, Accent> = { "en-GB": "British", "en-US": "American", "en-AU": "Australian" };

/** The device's English voices in the three accents the player offers. */
export function accentOf(voice: SpeechSynthesisVoice): Accent | null {
  return ACCENTS[voice.lang.replace("_", "-")] ?? null;
}

// Names that devices give their female British voices, for the default.
const BRITISH_WOMEN = /female|sonia|libby|maisie|hollie|abbi|bella|olivia|serena|kate|stephanie|martha|fiona|amy|emma|susan|hazel/i;

/** The default device voice: a British woman's voice if the device has one, else any British, else any English. */
export function defaultVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const british = voices.filter((v) => accentOf(v) === "British");
  return british.find((v) => BRITISH_WOMEN.test(v.name)) ?? british[0] ?? voices[0] ?? null;
}

/** A voice's name without the vendor and language: "Microsoft Libby Online (Natural) - English (United Kingdom)" → "Libby". */
export function voiceLabel(voice: SpeechSynthesisVoice): string {
  const name = voice.name
    .replace(/^(Microsoft|Google|Apple)\s+/i, "")
    .replace(/\s*-\s*English.*$/i, "")
    .replace(/\s*\((Natural|Enhanced|Premium)\)/i, "")
    .replace(/\s+Online$/i, "")
    .trim();
  return voice.localService ? name : `${name} (online)`;
}

/** The device's English voices (American, British, Australian), sorted by accent then name; [] where speech isn't supported. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => englishVoices());
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(englishVoices());
    // Voices often arrive after the page loads.
    window.speechSynthesis.addEventListener("voiceschanged", update);
    update();
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  return voices;
}

const ACCENT_ORDER: Accent[] = ["British", "American", "Australian"];

function englishVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => accentOf(v))
    .sort((a, b) => ACCENT_ORDER.indexOf(accentOf(a)!) - ACCENT_ORDER.indexOf(accentOf(b)!) || voiceLabel(a).localeCompare(voiceLabel(b)));
}
