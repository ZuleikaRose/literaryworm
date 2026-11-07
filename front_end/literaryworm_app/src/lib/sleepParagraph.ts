import { chapterAt } from "./reading";

/**
 * A gentler sleep timer for narration that reads text (natural and device voices): the minutes
 * chosen run on to the end of the paragraph being read then, so the fade lands on a break rather
 * than mid-sentence. The voice's clock runs evenly by character over a chapter (as the transcript
 * times it), so a paragraph's end is its share of the chapter's letters. Never more than
 * PARAGRAPH_GRACE_SECONDS more: a very long paragraph keeps the minutes as chosen.
 */
export const PARAGRAPH_GRACE_SECONDS = 120;

/** The share (0–1) of the chapter at which the paragraph holding `share` ends. */
export function paragraphEndShare(chapterText: string, share: number): number {
  const total = chapterText.replace(/\s+/g, " ").length;
  if (!total) return 1;
  const at = Math.min(1, Math.max(0, share)) * total;
  let start = 0;
  for (const paragraph of chapterText.split(/\n\s*\n/)) {
    const end = start + paragraph.replace(/\s+/g, " ").length;
    if (at <= end) return Math.min(1, end / total);
    start = end + 1;
  }
  return 1;
}

/** Seconds of listening for a sleep timer of `minutes` from `position` (book seconds), run on to a paragraph's end. */
export function sleepSecondsToParagraphEnd(input: { position: number; minutes: number; speed: number; starts: number[]; lengths: number[]; texts: string[] }): number {
  const { position, minutes, speed, starts, lengths, texts } = input;
  const chosen = minutes * 60;
  const target = position + chosen * speed;
  const c = chapterAt(starts, target);
  const length = lengths[c] ?? 0;
  const text = texts[c];
  if (!length || !text) return chosen;
  const share = Math.min(1, Math.max(0, (target - starts[c]) / length));
  const extra = ((paragraphEndShare(text, share) - share) * length) / Math.max(speed, 0.25);
  return extra > 0 && extra <= PARAGRAPH_GRACE_SECONDS ? chosen + extra : chosen;
}
