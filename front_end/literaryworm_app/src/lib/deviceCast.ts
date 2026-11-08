import { castSegments } from "./naturalVoice";

/**
 * Character voices with a device voice (Web Speech), for the classics' own text and uploads read
 * by the device: speechNarrator() reads each chapter in sentence parts (speakingParts(), which
 * collapses runs of whitespace), and these rules say which parts are speech, who says them, and
 * which of the device's voices (or, with only one voice in the language, which pitch) reads them.
 * Speech and speakers are found by castSegments(), the same rules the natural voices use.
 */

/** Where each character of `text` lands once runs of whitespace are one space, as speakingParts() reads it. */
export function collapsedIndex(text: string): number[] {
  const out = new Array<number>(text.length + 1);
  let n = 0;
  let inSpace = false;
  for (let i = 0; i < text.length; i++) {
    const space = /\s/.test(text[i]);
    if (space && inSpace) {
      out[i] = n - 1;
      continue;
    }
    out[i] = n;
    n += 1;
    inSpace = space;
  }
  out[text.length] = n;
  return out;
}

export interface CastPart {
  /** Where the part starts in the collapsed text, as speakingParts() counts. */
  offset: number;
  text: string;
  /** undefined for narration; the speaker named for speech, or null when none is named. */
  speaker: string | null | undefined;
}

/**
 * The narrator's parts cut again where speech starts and ends, so "“Not yet,” replied Darcy." is
 * read as the speech in Darcy's voice and "replied Darcy." by the narrator. Offsets stay those of
 * the collapsed text, so the narrator's clock and the read-along keep their places.
 */
export function castParts(chapter: string, parts: { offset: number; text: string }[]): CastPart[] {
  const segments = castSegments(chapter);
  if (!segments) return parts.map((p) => ({ ...p, speaker: undefined }));
  const at = collapsedIndex(chapter);
  const speeches = segments
    .filter((s) => s.speech)
    .map((s) => ({ start: at[s.offset], end: at[Math.min(chapter.length, s.offset + s.text.length)], speaker: s.speaker }));
  const out: CastPart[] = [];
  for (const p of parts) {
    const end = p.offset + p.text.length;
    // Every speech edge inside the part is a cut.
    const cuts = new Set<number>([p.offset, end]);
    for (const s of speeches) {
      if (s.start > p.offset && s.start < end) cuts.add(s.start);
      if (s.end > p.offset && s.end < end) cuts.add(s.end);
    }
    const points = [...cuts].sort((a, b) => a - b);
    for (let i = 0; i < points.length - 1; i++) {
      const text = p.text.slice(points[i] - p.offset, points[i + 1] - p.offset);
      if (!text.trim()) {
        // Keep the spaces with what came before, so the offsets still add up.
        if (out.length > 0 && out[out.length - 1].offset + out[out.length - 1].text.length === points[i]) out[out.length - 1].text += text;
        continue;
      }
      const middle = points[i] + text.length / 2;
      const found = speeches.find((s) => middle >= s.start && middle < s.end);
      out.push({ offset: points[i], text, speaker: found ? found.speaker : undefined });
    }
  }
  return out;
}

export interface DeviceVoiceLike {
  voiceURI: string;
  lang: string;
  /** The voice's name, which a listener's choice (lib/deviceCastChoices.ts) is kept by. */
  name?: string;
}

/** Pitches that tell speakers apart when the device has only one voice in the book's language. */
export const CAST_PITCHES = [0.8, 1.25, 0.9, 1.15, 0.85, 1.2] as const;

const hashName = (name: string) => {
  let h = 2166136261;
  for (const ch of name.toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0;
  return h;
};

const language = (lang: string) => lang.toLowerCase().split(/[-_]/)[0];

/**
 * The voice and pitch for a part: narration keeps the narrator's voice; a named speaker always gets
 * the same other voice in the narrator's language (by their name), unnamed speech the first other
 * one; with no other voice in that language, the narrator's voice at a pitch of the speaker's own.
 * A listener's choice for a named speaker comes first, when this device has that voice.
 */
export function castVoiceFor(
  voices: DeviceVoiceLike[],
  narrator: DeviceVoiceLike,
  speaker: string | null | undefined,
  choices: Record<string, string> = {},
): { voiceURI: string; pitch: number } {
  if (speaker === undefined) return { voiceURI: narrator.voiceURI, pitch: 1 };
  const picked = speaker ? choices[speaker.trim().toLowerCase()] : undefined;
  const chosen = picked ? voices.find((v) => v.name === picked) : undefined;
  if (chosen) return { voiceURI: chosen.voiceURI, pitch: 1 };
  const others = voices
    .filter((v) => v.voiceURI !== narrator.voiceURI && language(v.lang) === language(narrator.lang))
    .sort((a, b) => a.voiceURI.localeCompare(b.voiceURI));
  if (others.length > 0) {
    const pick = speaker === null ? others[0] : others[hashName(speaker) % others.length];
    return { voiceURI: pick.voiceURI, pitch: 1 };
  }
  const pitch = speaker === null ? CAST_PITCHES[1] : CAST_PITCHES[hashName(speaker) % CAST_PITCHES.length];
  return { voiceURI: narrator.voiceURI, pitch };
}
