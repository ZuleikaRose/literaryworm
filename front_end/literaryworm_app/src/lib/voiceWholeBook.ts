import { CHARACTERS_PER_HOUR, chapterPieces, type NaturalVoice } from "./naturalVoice";

/**
 * *Voice the whole book* (members' uploads with a natural voice, components/VoiceWholeBook.tsx):
 * every part of every chapter voiced and kept on this device ahead of time, on Wi-Fi, one after
 * another, the same parts the player plays (chapterPieces(), with character voices or without).
 * Parts already voiced cost nothing; new ones count towards the month's natural-voice reading.
 */

export interface WholeBookPlan {
  /** Every part, in reading order: [chapter, part]. */
  parts: [number, number][];
  /** Characters in all of them. */
  characters: number;
  /** About how long the book takes a natural voice to read, in hours (1×). */
  hours: number;
}

export function wholeBookPlan(chapters: string[], narrator: NaturalVoice, characterVoices: boolean): WholeBookPlan {
  const parts: [number, number][] = [];
  let characters = 0;
  chapters.forEach((text, c) => {
    chapterPieces(text, narrator, characterVoices).forEach((piece, s) => {
      parts.push([c, s]);
      characters += piece.text.length;
    });
  });
  return { parts, characters, hours: characters / CHARACTERS_PER_HOUR };
}

/**
 * Whether the book fits in what's left of this month's natural-voice reading (`leftSeconds`), at
 * most: parts voiced before don't count, so it may need less. Null when the allowance isn't known.
 */
export function fitsAllowance(plan: WholeBookPlan, leftSeconds: number | null): boolean | null {
  if (leftSeconds === null) return null;
  return plan.hours * 3600 <= leftSeconds;
}
