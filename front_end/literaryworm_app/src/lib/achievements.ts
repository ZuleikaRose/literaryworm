import { getBook } from "../data/books";
import type { Highlight, ReadingDay, SavedWord } from "../types";
import { STREAK_SECONDS } from "./goals";
import { allSeries } from "./series";

/**
 * Badges: milestones worked out in the browser from what a profile already keeps (reading days,
 * goals, My words, highlights), the same way stats are, so nothing new is stored. Each badge knows
 * the day it was earned, so the bell can show it as new for a week (like a goal reached).
 */
export interface BadgeRule {
  id: string;
  title: string;
  /** What earns it. */
  description: string;
  target: number;
  /** Icon name. */
  icon: "bookOpen" | "clock" | "headphones" | "star" | "dictionary" | "highlighter" | "list" | "library";
}

export interface Badge extends BadgeRule {
  progress: number;
  /** When it was earned (local midnight of the day, or the moment for words and highlights), or null. */
  earnedAt: number | null;
}

export const BADGE_RULES: BadgeRule[] = [
  { id: "first-book", title: "First finish", description: "Finish a book", target: 1, icon: "bookOpen" },
  { id: "books-10", title: "Ten books", description: "Finish 10 books", target: 10, icon: "library" },
  { id: "books-50", title: "Fifty books", description: "Finish 50 books", target: 50, icon: "library" },
  { id: "streak-7", title: "A week in a row", description: "Read or listen 7 days in a row", target: 7, icon: "clock" },
  { id: "streak-30", title: "A month in a row", description: "Read or listen 30 days in a row", target: 30, icon: "clock" },
  { id: "hours-10", title: "Ten hours", description: "Spend 10 hours reading or listening", target: 10, icon: "clock" },
  { id: "hours-100", title: "A hundred hours", description: "Spend 100 hours reading or listening", target: 100, icon: "clock" },
  { id: "listener-10", title: "Good listener", description: "Listen for 10 hours", target: 10, icon: "headphones" },
  { id: "genres-5", title: "Explorer", description: "Finish books in 5 different genres", target: 5, icon: "star" },
  { id: "classics-10", title: "Classic reader", description: "Finish 10 public-domain classics", target: 10, icon: "bookOpen" },
  { id: "series-1", title: "Series complete", description: "Finish every book of a series on LiteraryWorm", target: 1, icon: "list" },
  { id: "goal", title: "Goal reached", description: "Reach a yearly reading goal", target: 1, icon: "star" },
  { id: "words-10", title: "Word collector", description: "Keep 10 words in My words", target: 10, icon: "dictionary" },
  { id: "highlights-25", title: "Highlighter", description: "Make 25 highlights", target: 25, icon: "highlighter" },
];

/** How long a new badge stays in the bell. */
export const BADGE_NEW_DAYS = 7;

export interface BadgeInput {
  readingDays: Record<string, ReadingDay>;
  readingGoals: Record<number, number>;
  words: SavedWord[];
  highlights: Highlight[];
}

const DAY_MS = 86_400_000;
const midnight = (day: string) => new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))).getTime();

/** A running count that remembers when it first reached each target. */
class Tally {
  value = 0;
  readonly reached = new Map<number, number>();

  add(by: number, at: number, targets: number[]) {
    if (by <= 0) return;
    this.value += by;
    for (const t of targets) if (this.value >= t && !this.reached.has(t)) this.reached.set(t, at);
  }
}

export function badges({ readingDays, readingGoals, words, highlights }: BadgeInput): Badge[] {
  const target = (id: string) => BADGE_RULES.find((r) => r.id === id)!.target;
  const finished = new Tally();
  const hours = new Tally();
  const listened = new Tally();
  const classics = new Tally();
  const genres = new Set<string>();
  const genreReached = new Map<number, number>();
  const finishedIds = new Set<string>();
  let seriesDone: number | null = null;
  let goalAt: number | null = null;
  const yearCount = new Map<number, number>();
  let streak = 0;
  let longest = 0;
  const streakReached = new Map<number, number>();
  let previous: number | null = null;

  for (const day of Object.keys(readingDays).sort()) {
    const d = readingDays[day];
    const at = midnight(day);
    finished.add(d.finished, at, [1, 10, 50]);
    hours.add(d.seconds / 3600, at, [10, 100]);
    listened.add((d.listened ?? 0) / 3600, at, [10]);
    for (const id of d.books ?? []) {
      finishedIds.add(id);
      const book = getBook(id);
      if (!book) continue;
      if (book.publicDomain) classics.add(1, at, [10]);
      for (const g of book.genres) genres.add(g);
      if (genres.size >= 5 && !genreReached.has(5)) genreReached.set(5, at);
      if (seriesDone === null && allSeries.some((s) => s.ids.length >= 2 && s.ids.includes(id) && s.ids.every((x) => finishedIds.has(x)))) seriesDone = at;
    }
    const year = Number(day.slice(0, 4));
    yearCount.set(year, (yearCount.get(year) ?? 0) + d.finished);
    const goal = readingGoals[year];
    if (goalAt === null && goal && d.finished > 0 && (yearCount.get(year) ?? 0) >= goal) goalAt = at;
    if (d.seconds >= STREAK_SECONDS) {
      streak = previous !== null && Math.round((at - previous) / DAY_MS) === 1 ? streak + 1 : 1;
      previous = at;
      longest = Math.max(longest, streak);
      for (const t of [7, 30]) if (streak >= t && !streakReached.has(t)) streakReached.set(t, at);
    }
  }

  const nth = (times: number[], n: number) => {
    const sorted = [...times].sort((a, b) => a - b);
    return sorted.length >= n ? sorted[n - 1] : null;
  };

  const results: Record<string, { progress: number; earnedAt: number | null }> = {
    "first-book": { progress: finished.value, earnedAt: finished.reached.get(1) ?? null },
    "books-10": { progress: finished.value, earnedAt: finished.reached.get(10) ?? null },
    "books-50": { progress: finished.value, earnedAt: finished.reached.get(50) ?? null },
    "streak-7": { progress: longest, earnedAt: streakReached.get(7) ?? null },
    "streak-30": { progress: longest, earnedAt: streakReached.get(30) ?? null },
    "hours-10": { progress: Math.floor(hours.value), earnedAt: hours.reached.get(10) ?? null },
    "hours-100": { progress: Math.floor(hours.value), earnedAt: hours.reached.get(100) ?? null },
    "listener-10": { progress: Math.floor(listened.value), earnedAt: listened.reached.get(10) ?? null },
    "genres-5": { progress: genres.size, earnedAt: genreReached.get(5) ?? null },
    "classics-10": { progress: classics.value, earnedAt: classics.reached.get(10) ?? null },
    "series-1": { progress: seriesDone === null ? 0 : 1, earnedAt: seriesDone },
    goal: { progress: goalAt === null ? 0 : 1, earnedAt: goalAt },
    "words-10": { progress: words.length, earnedAt: nth(words.map((w) => w.createdAt), target("words-10")) },
    "highlights-25": { progress: highlights.length, earnedAt: nth(highlights.map((h) => h.createdAt), target("highlights-25")) },
  };
  return BADGE_RULES.map((rule) => {
    const r = results[rule.id];
    return { ...rule, progress: Math.min(rule.target, r.progress), earnedAt: r.earnedAt };
  });
}

export const earnedBadges = (list: Badge[]) => list.filter((b) => b.earnedAt !== null);

/** Badges earned in the last week, newest first: the bell's alerts. */
export function badgeAlerts(list: Badge[], now: number): { badge: Badge; at: number }[] {
  return earnedBadges(list)
    .filter((b) => now - b.earnedAt! < BADGE_NEW_DAYS * DAY_MS && b.earnedAt! <= now)
    .sort((a, b) => b.earnedAt! - a.earnedAt!)
    .map((badge) => ({ badge, at: badge.earnedAt! }));
}
