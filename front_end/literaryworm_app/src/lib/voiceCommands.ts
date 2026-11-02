/**
 * Voice control in car mode: what a spoken phrase asks for. The browser's own speech recognition
 * hears it (components/VoiceControl.tsx); this only reads the words. In English, and forgiving:
 * "pause", "stop", "go back thirty seconds", "skip forward", "next chapter", "exit car mode".
 */

export type VoiceCommand =
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "back"; seconds: number | null }
  | { kind: "forward"; seconds: number | null }
  | { kind: "nextChapter" }
  | { kind: "previousChapter" }
  | { kind: "exit" };

/** The phrases listed under the voice control button, so people know what to say. */
export const VOICE_HINTS = ["Play", "Pause", "Back", "Forward", "Next chapter", "Previous chapter", "Exit car mode"];

/** The longest skip a phrase can ask for: ten minutes. */
export const VOICE_SKIP_MAX = 600;

const WORDS: Record<string, number> = {
  five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty five": 45, fortyfive: 45, sixty: 60, ninety: 90,
  "a minute": 60, "one minute": 60, "two minutes": 120, "five minutes": 300, "ten minutes": 600,
};

/** Seconds named in a phrase ("30 seconds", "thirty", "2 minutes", "a minute"), or null. */
export function spokenSeconds(text: string): number | null {
  const minutes = text.match(/(\d+)\s*(?:minute|min)s?\b/);
  if (minutes) return Math.min(VOICE_SKIP_MAX, Number(minutes[1]) * 60);
  const seconds = text.match(/(\d+)\s*(?:seconds?|secs?|s\b)?/);
  if (seconds) return Math.min(VOICE_SKIP_MAX, Math.max(1, Number(seconds[1])));
  for (const [phrase, value] of Object.entries(WORDS).sort((a, b) => b[0].length - a[0].length)) {
    if (new RegExp(`\\b${phrase}\\b`).test(text)) return value;
  }
  return null;
}

/** What the phrase asks for, or null when it isn't a command (so stray talk does nothing). */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const text = transcript.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (/\b(exit|leave|close|quit)\b.*\bcar\b|\bexit car mode\b/.test(text)) return { kind: "exit" };
  if (/\b(next|following) chapter\b|\bskip (the |this )?chapter\b/.test(text)) return { kind: "nextChapter" };
  if (/\b(previous|last|prior) chapter\b|\bchapter back\b|\bback (a|one) chapter\b/.test(text)) return { kind: "previousChapter" };
  if (/\b(back|rewind|backward|backwards|replay)\b/.test(text)) return { kind: "back", seconds: spokenSeconds(text) };
  if (/\b(forward|forwards|ahead|skip)\b/.test(text)) return { kind: "forward", seconds: spokenSeconds(text) };
  if (/\b(pause|stop|hold on|wait)\b/.test(text)) return { kind: "pause" };
  if (/\b(play|resume|continue|start|go on|keep going)\b/.test(text)) return { kind: "play" };
  return null;
}

/** Words for the status line after a command, said back to the listener. */
export function voiceCommandLabel(command: VoiceCommand, skip: { back: number; forward: number }): string {
  switch (command.kind) {
    case "play":
      return "Playing";
    case "pause":
      return "Paused";
    case "back":
      return `Back ${command.seconds ?? skip.back} seconds`;
    case "forward":
      return `Forward ${command.seconds ?? skip.forward} seconds`;
    case "nextChapter":
      return "Next chapter";
    case "previousChapter":
      return "Previous chapter";
    case "exit":
      return "Leaving car mode";
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

/** The language to listen in: the browser's own when it's English, else British English. */
export const voiceLanguage = (browser: string | undefined) => (browser?.toLowerCase().startsWith("en") ? browser : "en-GB");
