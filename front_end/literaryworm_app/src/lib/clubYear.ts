/**
 * A club's year together (components/ClubYear.tsx on the club page): shown in December for the year
 * that's ending and in January for the one just ended. Worked out in the browser from what the page
 * already has, never stored, and only from chapters the reader has reached (the same rule as posts
 * and shared highlights: nothing past their place is counted).
 */

export interface ClubYear {
  year: number;
  posts: number;
  /** Members who posted at least once. */
  posters: number;
  meetings: number;
  highlights: number;
  /** The chapter with the most posts (0-based), or null with none. */
  busiestChapter: number | null;
}

/** The year the card is about, or null outside December and January (local time). */
export function clubYearShown(now: Date): number | null {
  const month = now.getMonth();
  if (month === 11) return now.getFullYear();
  if (month === 0) return now.getFullYear() - 1;
  return null;
}

const inYear = (ms: number, year: number) => new Date(ms).getFullYear() === year;

export function clubYear(
  input: {
    posts: { userId: string; chapterIndex: number; createdAt: number }[];
    meetings: { startsAt: string }[];
    highlights: { chapterIndex: number; createdAt: number }[];
    /** The reader's chapter: nothing later is counted. */
    upTo: number;
  },
  year: number,
  now = Date.now(),
): ClubYear {
  const posts = input.posts.filter((p) => p.chapterIndex <= input.upTo && inYear(p.createdAt, year));
  const byChapter = new Map<number, number>();
  for (const p of posts) byChapter.set(p.chapterIndex, (byChapter.get(p.chapterIndex) ?? 0) + 1);
  let busiestChapter: number | null = null;
  for (const [chapter, n] of byChapter) {
    if (busiestChapter === null || n > byChapter.get(busiestChapter)! || (n === byChapter.get(busiestChapter) && chapter < busiestChapter)) busiestChapter = chapter;
  }
  return {
    year,
    posts: posts.length,
    posters: new Set(posts.map((p) => p.userId)).size,
    // Meetings already held, that year.
    meetings: input.meetings.filter((m) => {
      const at = Date.parse(m.startsAt);
      return at <= now && inYear(at, year);
    }).length,
    highlights: input.highlights.filter((h) => h.chapterIndex <= input.upTo && inYear(h.createdAt, year)).length,
    busiestChapter,
  };
}
