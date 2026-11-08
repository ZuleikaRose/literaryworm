import { setCastMedia } from "./cast";
import { useEffect, useState } from "react";
import { samplePageSentences } from "../data/sampleText";
import { loadUploadText } from "./uploadsApi";
import { tabTexts } from "./uploads";
import { DEMO_UPLOAD_TEXTS } from "../data/demoUploads";
import { keepUploadOffline, offlineUploadText } from "./uploadCache";
import type { Book, RecordingTrack } from "../types";
import { readerPages } from "./reading";
import { tr } from "./i18n";
import { castParts, castVoiceFor } from "./deviceCast";
import { speakingParts } from "./speaking";
import { type Anchor, charactersAt, findPauses, pauseAnchors, secondsAt } from "./pauseTiming";
import { defaultNaturalVoice, NATURAL_PREFIX, type NaturalVoice, type VoiceSegment, voicesFor, voiceSegments } from "./naturalVoice";

/**
 * Who reads an audiobook aloud. The playback engine (components/PlaybackProvider.tsx) keeps the
 * clock, sleep timer, limits and saving; a narrator only makes the sound and says where it is.
 * Three kinds: a book's LibriVox recording, the device's own voices reading the text, and (for
 * members' uploads) a natural voice from Google reading it a piece at a time (lib/naturalVoice.ts).
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
  /** 0–1 (0 when muted). */
  setVolume: (volume: number) => void;
  dispose: () => void;
}

export const LIBRIVOX_VOICE = "librivox";
export const SILENT_VOICE = "silent";

export type Narration =
  | { kind: "recording" }
  | { kind: "speech"; voice: SpeechSynthesisVoice }
  | { kind: "natural"; voice: NaturalVoice }
  | { kind: "silent" };

/**
 * Who reads `book` for a profile's choice (ProfileData.narrationVoice) on this device. The
 * recording is the default where there is one; where natural voices are offered (`natural`: a
 * member's upload, not on Kids profiles) the default is the first natural voice; a voice the
 * device doesn't have falls back to the default; with no voices at all, the sample clock runs
 * silently.
 */
export function resolveNarration(book: Book, choice: string | null, voices: SpeechSynthesisVoice[], natural = false): Narration {
  if (choice === SILENT_VOICE && !book.recording) return { kind: "silent" };
  // A natural voice chosen for this book's language (or English); another language's voice falls back to the default.
  const naturalChoice = natural && choice?.startsWith(NATURAL_PREFIX)
    ? voicesFor(book.language).find((v) => v.id === choice.slice(NATURAL_PREFIX.length)) ?? null
    : null;
  if (naturalChoice) return { kind: "natural", voice: naturalChoice };
  const chosen = choice ? voices.find((v) => v.voiceURI === choice) : undefined;
  if (chosen) return { kind: "speech", voice: chosen };
  if (book.recording) return { kind: "recording" };
  if (natural) return { kind: "natural", voice: defaultNaturalVoice(book.language) };
  const fallback = defaultVoice(voices);
  return fallback ? { kind: "speech", voice: fallback } : { kind: "silent" };
}

/** ProfileData.narrationVoice for a narration (the player's Voice menu). */
export function narrationValue(narration: Narration): string {
  switch (narration.kind) {
    case "speech":
      return narration.voice.voiceURI;
    case "natural":
      return NATURAL_PREFIX + narration.voice.id;
    case "recording":
      return LIBRIVOX_VOICE;
    default:
      return SILENT_VOICE;
  }
}

/** The book's LibriVox recording: one audio element playing one chapter's track at a time. */
export function recordingNarrator(tracks: RecordingTrack[], starts: number[], events: NarratorEvents): Narrator {
  const audio = new Audio();
  audio.preload = "auto";
  setCastMedia(audio);
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
          ? tr("Press play to start the narration.")
          : tr("We couldn't play the narration. Check your connection, then press play to try again."),
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
    events.onError(tr("We couldn't load the narration. Check your connection, then press play to try again."));
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
    // iPhones and iPads ignore this (their volume is the device's); muting still works there.
    setVolume: (volume) => {
      audio.volume = volume;
      audio.muted = volume === 0;
    },
    dispose: () => {
      setCastMedia(null);
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
// The pieces a voice speaks live in lib/speaking.ts (pure); re-exported for existing imports.
export { type Part, speakingParts } from "./speaking";

/** The device's voice reading `chapters` (one text each), timed to the book's chapter lengths. */
export function speechNarrator(
  chapters: string[],
  starts: number[],
  lengths: number[],
  voice: SpeechSynthesisVoice,
  events: NarratorEvents,
  /** Character voices (lib/deviceCast.ts): speech read by the device's other voices, or at another pitch. */
  cast?: { voices: SpeechSynthesisVoice[]; rateFor?: (part: { speaker?: string | null }) => number },
): Narrator {
  const synth = window.speechSynthesis;
  const parts: { offset: number; text: string; speaker?: string | null }[][] = chapters.map((c) =>
    cast ? castParts(c, speakingParts(c)) : speakingParts(c),
  );
  const sizes = chapters.map((_, i) => {
    const last = parts[i][parts[i].length - 1];
    return last ? last.offset + last.text.length : 1;
  });
  let chapter = 0;
  let part = 0;
  let rate = 1;
  let volume = 1;
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
    const chosen = cast ? castVoiceFor(cast.voices, voice, current.speaker) : null;
    utterance.voice = (chosen && cast!.voices.find((v) => v.voiceURI === chosen.voiceURI)) || voice;
    utterance.lang = voice.lang;
    if (chosen) utterance.pitch = chosen.pitch;
    utterance.rate = rate * (cast?.rateFor?.(current) ?? 1);
    utterance.volume = volume;
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
        e.error === "not-allowed" ? tr("Press play to start the narration.") : tr("This voice stopped working. Try another voice from the list."),
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
    setVolume: (next) => {
      const was = volume;
      volume = next;
      // A voice can't change volume mid-sentence; muting or unmuting starts the sentence again so it's heard at once.
      if (speaking && (was === 0) !== (next === 0)) {
        generation += 1;
        synth.cancel();
        speakPart();
      }
    },
    dispose: () => {
      stop();
      generation += 1;
    },
  };
}

/**
 * A natural voice reading `chapters` (one text each) a piece at a time: each piece's link comes
 * from `pieceUrl` (the natural-voice function voices it the first time), and the next piece is
 * asked for while one plays, so they follow on. Timed like a device voice: the chapter's length
 * shared out by characters. Plays at any speed (one copy, voiced at 1×).
 */
export function naturalNarrator(
  chapters: string[],
  starts: number[],
  lengths: number[],
  pieceUrl: (chapter: number, segment: number) => Promise<string>,
  events: NarratorEvents,
  /** Told the chapter that's playing, each time a part starts (to keep parts ahead for offline). */
  playingChapter?: (chapter: number) => void,
  /** How a chapter is cut into pieces (chapterPieces() with character voices; the same cut as `pieceUrl` uses). */
  piecesFor: (text: string) => VoiceSegment[] = voiceSegments,
  /** A part's speed as a share of the player's: its speaker's own (lib/castSpeeds.ts), else 1. */
  rateFor: (piece: VoiceSegment & { speaker?: string | null }) => number = () => 1,
): Narrator {
  const audio = new Audio();
  let baseRate = 1;
  // A new src resets the rate to defaultPlaybackRate, so both are set for each part.
  const applyRate = () => {
    const piece = piecesOf(chapter)[segment];
    const rate = baseRate * (piece ? rateFor(piece) : 1);
    audio.defaultPlaybackRate = rate;
    audio.playbackRate = rate;
  };
  audio.preload = "auto";
  const pieces: (VoiceSegment[] | undefined)[] = [];
  const piecesOf = (c: number) => (pieces[c] ??= piecesFor(chapters[c] ?? ""));
  const sizeOf = (c: number) => {
    const last = piecesOf(c).at(-1);
    return last ? last.offset + last.text.length : 1;
  };
  const links = new Map<string, Promise<string>>();
  const linkFor = (c: number, s: number) => {
    const key = `${c}:${s}`;
    let link = links.get(key);
    if (!link) {
      link = pieceUrl(c, s);
      link.catch(() => links.delete(key));
      links.set(key, link);
    }
    return link;
  };

  // Each part's sentence starts, timed from its pauses (lib/pauseTiming.ts) once it has loaded.
  const timings = new Map<string, Anchor[] | null>();
  const measure = (key: string, url: string, piece: VoiceSegment) => {
    if (timings.has(key) || typeof OfflineAudioContext === "undefined") return;
    timings.set(key, null);
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => new OfflineAudioContext(1, 1, 44100).decodeAudioData(data))
      .then((audioData) => {
        const breaks = speakingParts(piece.text).map((p) => p.offset).filter((o) => o > 0);
        timings.set(key, pauseAnchors(breaks, piece.text.length, audioData.duration, findPauses(audioData.getChannelData(0), audioData.sampleRate)));
      })
      // Without it the part is timed evenly by characters, as before.
      .catch(() => undefined);
  };
  /** Seconds into the loaded part for a share of its text (0–1). */
  const secondsFor = (share: number) => {
    const anchors = timings.get(here());
    const piece = piecesOf(chapter)[segment];
    return anchors && piece ? secondsAt(anchors, share * piece.text.length) : share * audio.duration;
  };

  let chapter = 0;
  let segment = 0;
  let within = 0; // how far into the piece to start, 0–1, until it's loaded
  let loaded: string | null = null; // the piece in the audio element, as "chapter:segment"
  let playing = false;
  let cued = false;
  let retried = false;
  let generation = 0; // a load from before a cue or a stop doesn't play

  const here = () => `${chapter}:${segment}`;
  const fail = (message: string) => {
    playing = false;
    events.onError(message);
  };

  /** Puts the current piece in the audio element (asking for its link first) and plays it if wanted. */
  const load = () => {
    const mine = ++generation;
    if (segment >= piecesOf(chapter).length) {
      // An empty chapter, or past the last piece: the chapter is over. The engine cues the next
      // one and starts it (or doesn't, at a sleep timer).
      if (playing) {
        playing = false;
        events.onChapterEnd(chapter);
      }
      return;
    }
    if (loaded === here()) {
      if (playing) audio.play().catch(onPlayError);
      return;
    }
    if (playing) events.onWaiting();
    linkFor(chapter, segment).then(
      (url) => {
        if (mine !== generation) return;
        loaded = here();
        audio.src = url;
        applyRate();
        measure(here(), url, piecesOf(chapter)[segment]);
        const startAt = within;
        if (startAt > 0) {
          audio.addEventListener("loadedmetadata", () => {
            if (loaded === here() && Number.isFinite(audio.duration)) audio.currentTime = secondsFor(startAt);
          }, { once: true });
        }
        if (playing) audio.play().catch(onPlayError);
      },
      (err: unknown) => {
        if (mine !== generation) return;
        if (playing) fail(err instanceof Error ? err.message : tr("We couldn't play the narration. Check your connection, then press play to try again."));
      },
    );
  };

  const onPlayError = (err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") return;
    fail(
      err instanceof DOMException && err.name === "NotAllowedError"
        ? tr("Press play to start the narration.")
        : tr("We couldn't play the narration. Check your connection, then press play to try again."),
    );
  };

  const onEnded = () => {
    if (!playing) return;
    segment += 1;
    within = 0;
    if (segment >= piecesOf(chapter).length) {
      playing = false;
      events.onChapterEnd(chapter);
      return;
    }
    load();
  };
  const onWaiting = () => events.onWaiting();
  const onPlaying = () => {
    retried = false;
    events.onPlaying();
    playingChapter?.(chapter);
    // Ask for the next piece now, so it's voiced before this one ends.
    const next = segment + 1 < piecesOf(chapter).length ? [chapter, segment + 1] : chapter + 1 < chapters.length ? [chapter + 1, 0] : null;
    if (next) linkFor(next[0], next[1]).catch(() => undefined);
  };
  const onError = () => {
    if (!loaded) return;
    // A link runs out after an hour: ask for a fresh one once.
    const at = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : within;
    links.delete(loaded);
    loaded = null;
    if (!retried) {
      retried = true;
      within = at;
      load();
      return;
    }
    if (playing) fail(tr("We couldn't load the narration. Check your connection, then press play to try again."));
  };
  audio.addEventListener("ended", onEnded);
  audio.addEventListener("waiting", onWaiting);
  audio.addEventListener("playing", onPlaying);
  audio.addEventListener("error", onError);

  return {
    cue: (seconds) => {
      cued = true;
      chapter = starts.reduce((found, start, i) => (seconds >= start ? i : found), 0);
      const target = (Math.max(0, seconds - starts[chapter]) / lengths[chapter]) * sizeOf(chapter);
      const list = piecesOf(chapter);
      const index = list.findIndex((p) => p.offset + p.text.length > target);
      segment = index < 0 ? list.length : index;
      const piece = list[segment];
      within = piece ? Math.min(1, Math.max(0, (target - piece.offset) / piece.text.length)) : 0;
      if (loaded === here() && Number.isFinite(audio.duration)) {
        audio.currentTime = secondsFor(within);
        if (playing) audio.play().catch(onPlayError);
        return;
      }
      audio.pause();
      // Loaded (but not played) straight away, so Play can start it inside the click.
      load();
    },
    start: () => {
      if (playing) return;
      playing = true;
      load();
    },
    stop: () => {
      playing = false;
      generation += 1;
      audio.pause();
    },
    isPlaying: () => playing,
    position: () => {
      if (!cued) return null;
      const piece = piecesOf(chapter)[segment];
      if (!piece) return starts[chapter] + lengths[chapter];
      const playing = loaded === here() && Number.isFinite(audio.duration) && audio.duration > 0;
      const anchors = playing ? timings.get(here()) : null;
      // Timed by the part's pauses when measured, else evenly by characters.
      const into = anchors ? charactersAt(anchors, audio.currentTime) : (playing ? audio.currentTime / audio.duration : within) * piece.text.length;
      return starts[chapter] + ((piece.offset + into) / sizeOf(chapter)) * lengths[chapter];
    },
    setRate: (rate) => {
      baseRate = rate;
      applyRate();
    },
    setVolume: (volume) => {
      audio.volume = volume;
      audio.muted = volume === 0;
    },
    dispose: () => {
      playing = false;
      generation += 1;
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

const textCache = new Map<string, Promise<string[]>>();

/**
 * What a voice reads for each chapter: the full public-domain text where the book has a
 * recording (public/texts, from Project Gutenberg), otherwise the reader's sample text.
 */
/**
 * An uploaded book's text: from this tab (the demo), else from Storage, kept on the device as it
 * loads; without a connection, the copy kept on the device.
 */
async function uploadText(id: string, path: string | null): Promise<string[]> {
  // Uploaded in this tab, or one of the demo's sample uploads.
  const kept = tabTexts.get(id) ?? DEMO_UPLOAD_TEXTS.get(id);
  if (kept) return kept;
  if (!path) throw new Error(tr("This book was uploaded in another tab. Upload it again here."));
  try {
    const chapters = await loadUploadText(path);
    keepUploadOffline(id, chapters).catch((err: unknown) => console.error("uploads: couldn't keep a copy for offline:", err));
    return chapters;
  } catch (err) {
    const offline = await offlineUploadText(id).catch(() => null);
    if (offline) return offline;
    throw err;
  }
}

export function bookText(book: Book): Promise<string[]> {
  let text = textCache.get(book.id);
  if (!text) {
    text = book.upload
      ? uploadText(book.id, book.upload.path)
      : book.recording
      ? fetch(`/texts/${book.id}.json`)
          .then(async (res) => {
            if (!res.ok) throw new Error();
            const chapters = ((await res.json()) as { chapters?: unknown }).chapters;
            if (!Array.isArray(chapters) || !chapters.every((c) => typeof c === "string")) throw new Error();
            return chapters as string[];
          })
          // Offline, a failed download or a damaged file all read the same to the reader.
          .catch(() => {
            throw new Error(tr("We couldn't load this book's text. Check your connection and try again."));
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
  return voice.localService ? name : tr("{name} (online)", { name });
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
