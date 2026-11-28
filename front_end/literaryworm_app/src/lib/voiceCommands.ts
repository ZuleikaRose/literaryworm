import { tr, type UiLanguage } from "./i18n";
import { normalizeSpoken, recognizerLanguage, says, VOICE_VOCAB } from "./voiceVocab";

/**
 * Voice control in car mode: what a spoken phrase asks for. The browser's own speech recognition
 * hears it (components/VoiceControl.tsx); this only reads the words, in the interface language
 * (lib/voiceVocab.ts). Forgiving: "pause", "stop", "go back thirty seconds", "skip forward",
 * "next chapter", "exit car mode", or "atrás 30 segundos", "chapitre suivant", "次の章".
 */

export type VoiceCommand =
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "back"; seconds: number | null }
  | { kind: "forward"; seconds: number | null }
  | { kind: "nextChapter" }
  | { kind: "previousChapter" }
  | { kind: "exit" };

/** The phrases the help shows, so people know what to say: the first of each kind, in the language. */
export function voiceHints(lang: UiLanguage = "en"): string[] {
  const v = VOICE_VOCAB[lang];
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(lang === "tl" ? "fil" : lang) + s.slice(1);
  return [v.play[0], v.pause[0], v.back[0], v.forward[0], v.nextChapter[0], v.previousChapter[0], v.exit[0]].map(cap);
}

/** The English phrases (kept for existing callers). */
export const VOICE_HINTS = voiceHints("en");

/** The longest skip a phrase can ask for: ten minutes. */
export const VOICE_SKIP_MAX = 600;

/** Seconds named in a phrase ("30 seconds", "thirty", "2 minutes", "a minute", "2 minutos"), or null. */
export function spokenSeconds(text: string, lang: UiLanguage = "en"): number | null {
  const v = VOICE_VOCAB[lang];
  const minuteWords = v.minutes.map((w) => normalizeSpoken(w, lang).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const minutes = text.match(new RegExp(`(\\d+)\\s*(?:${minuteWords})`, "u"));
  if (minutes) return Math.min(VOICE_SKIP_MAX, Number(minutes[1]) * 60);
  const seconds = text.match(/(\d+)/);
  if (seconds) return Math.min(VOICE_SKIP_MAX, Math.max(1, Number(seconds[1])));
  for (const [phrase, value] of Object.entries(v.numbers ?? {}).sort((a, b) => b[0].length - a[0].length)) {
    if (says(text, phrase, lang)) return value;
  }
  return null;
}

/** English, as it was first written: a little looser than the word lists (any "exit … car"). */
function parseEnglish(text: string): VoiceCommand | null {
  if (/\b(exit|leave|close|quit)\b.*\bcar\b|\bexit car mode\b/.test(text)) return { kind: "exit" };
  if (/\b(next|following) chapter\b|\bskip (the |this )?chapter\b/.test(text)) return { kind: "nextChapter" };
  if (/\b(previous|last|prior) chapter\b|\bchapter back\b|\bback (a|one) chapter\b/.test(text)) return { kind: "previousChapter" };
  if (/\b(back|rewind|backward|backwards|replay)\b/.test(text)) return { kind: "back", seconds: spokenSeconds(text, "en") };
  if (/\b(forward|forwards|ahead|skip)\b/.test(text)) return { kind: "forward", seconds: spokenSeconds(text, "en") };
  if (/\b(pause|stop|hold on|wait)\b/.test(text)) return { kind: "pause" };
  if (/\b(play|resume|continue|start|go on|keep going)\b/.test(text)) return { kind: "play" };
  return null;
}

/** What the phrase asks for, or null when it isn't a command (so stray talk does nothing). */
export function parseVoiceCommand(transcript: string, lang: UiLanguage = "en"): VoiceCommand | null {
  const text = normalizeSpoken(transcript, lang);
  if (!text) return null;
  if (lang === "en") return parseEnglish(text);
  const v = VOICE_VOCAB[lang];
  const any = (phrases: string[]) => phrases.some((p) => says(text, p, lang));
  // Longer, more particular phrases first: "next chapter" holds words for "forward" in some languages.
  if (any(v.exit)) return { kind: "exit" };
  if (any(v.nextChapter)) return { kind: "nextChapter" };
  if (any(v.previousChapter)) return { kind: "previousChapter" };
  if (any(v.back)) return { kind: "back", seconds: spokenSeconds(text, lang) };
  if (any(v.forward)) return { kind: "forward", seconds: spokenSeconds(text, lang) };
  if (any(v.pause)) return { kind: "pause" };
  if (any(v.play)) return { kind: "play" };
  return null;
}

/** Words for the status line after a command, said back to the listener. */
export function voiceCommandLabel(command: VoiceCommand, skip: { back: number; forward: number }): string {
  switch (command.kind) {
    case "play":
      return tr("Playing");
    case "pause":
      return tr("Paused");
    case "back":
      return tr("Back {n} seconds", { n: command.seconds ?? skip.back });
    case "forward":
      return tr("Forward {n} seconds", { n: command.seconds ?? skip.forward });
    case "nextChapter":
      return tr("Next chapter");
    case "previousChapter":
      return tr("Previous chapter");
    case "exit":
      return tr("Leaving car mode");
  }
}

/** The parts of the Web Speech API's recognizer car mode uses (TypeScript's DOM types don't have it). */
export interface Recognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
export type RecognizerClass = new () => Recognizer;

/** The browser's speech recognizer, or null where there isn't one (Firefox, for one). */
export function recognizerClass(): RecognizerClass | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Whether car mode offers voice control: the browser can hear speech, and it's not a Kids profile. */
export const voiceControlOffered = (ageRating: string | undefined) => recognizerClass() !== null && ageRating !== "kids";

/** The language to listen in: the interface language, in the browser's own variant of it when it has one. */
export const voiceLanguage = (browser: string | undefined, lang: UiLanguage = "en") => recognizerLanguage(lang, browser);
