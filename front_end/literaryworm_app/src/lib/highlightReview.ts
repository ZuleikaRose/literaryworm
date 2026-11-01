import type { Highlight } from "../types";

/**
 * Highlights review: spaced repetition for passages, like word review (lib/words.ts). A highlight
 * comes back the day after it's made, then 1, 3, 7, 14, 30 and 60 days after each *Still
 * matters*, and every 60 days after that (a highlight is never "learned"); *Again soon* brings it
 * back tomorrow at the first step. At most `DAILY_HIGHLIGHTS` a day, the longest overdue first,
 * so a big library doesn't become a chore. Members' dates are `highlights.review_due` and
 * `review_step` (migration 6562); in-memory accounts keep them on the highlight.
 */
export const HIGHLIGHT_INTERVALS = [1, 3, 7, 14, 30, 60];
export const DAILY_HIGHLIGHTS = 10;

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** The local day (YYYY-MM-DD) a highlight was made. */
const madeOn = (h: Highlight) => {
  const d = new Date(h.createdAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Due today: never reviewed and made before today, or its review day has come. */
export function isHighlightDue(h: Highlight, today: string): boolean {
  const due = h.reviewDue ?? null;
  return due === null ? madeOn(h) < today : due <= today;
}

/**
 * Answered today: the review day an answer today would have set. *Again soon* sets tomorrow at step
 * 0; *Still matters* sets the step's interval from today. Nothing else gives those pairs, so no
 * extra column is needed to count today's reviews.
 */
export function reviewedToday(h: Pick<Highlight, "reviewDue" | "reviewStep">, today: string): boolean {
  if (!h.reviewDue) return false;
  const step = h.reviewStep ?? 0;
  return h.reviewDue === addDays(today, step === 0 ? 1 : HIGHLIGHT_INTERVALS[Math.min(step, HIGHLIGHT_INTERVALS.length) - 1]);
}

/** What's left of today's `DAILY_HIGHLIGHTS` once today's answers are counted. */
export function reviewsLeftToday(highlights: Highlight[], today: string, daily = DAILY_HIGHLIGHTS): number {
  return Math.max(0, daily - highlights.filter((h) => reviewedToday(h, today)).length);
}

/** Today's review: due highlights, the longest waiting first, at most `limit`. */
export function dueHighlights(highlights: Highlight[], today: string, limit = DAILY_HIGHLIGHTS): Highlight[] {
  const waitingSince = (h: Highlight) => h.reviewDue ?? madeOn(h);
  return highlights
    .filter((h) => isHighlightDue(h, today))
    .sort((a, b) => waitingSince(a).localeCompare(waitingSince(b)) || a.createdAt - b.createdAt)
    .slice(0, Math.max(0, limit));
}

/** What an answer changes: the next review day and the step (0–6). */
export function nextHighlightReview(h: Pick<Highlight, "reviewStep">, stillMatters: boolean, today: string): { reviewDue: string; reviewStep: number } {
  if (!stillMatters) return { reviewDue: addDays(today, 1), reviewStep: 0 };
  const step = Math.min((h.reviewStep ?? 0) + 1, HIGHLIGHT_INTERVALS.length);
  return { reviewDue: addDays(today, HIGHLIGHT_INTERVALS[step - 1]), reviewStep: step };
}
