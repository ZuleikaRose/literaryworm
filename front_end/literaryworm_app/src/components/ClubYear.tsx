import { useMemo, useState } from "react";
import type { ClubMeeting } from "../lib/clubCalendar";
import type { ClubPost } from "../lib/clubs";
import { clubYear, clubYearShown } from "../lib/clubYear";
import { chapterLabel } from "../lib/reading";
import { useClubHighlights } from "../lib/useClubHighlights";
import { useT } from "../lib/useT";
import type { Book } from "../types";

/**
 * The club page's "{year} together" card (lib/clubYear.ts): December and January only, and always
 * in the demo so it can be seen. Counts only chapters the reader has reached.
 */
export function ClubYear({ clubId, book, posts, meetings, upTo, demo }: { clubId: string; book: Book; posts: ClubPost[]; meetings: ClubMeeting[]; upTo: number; demo: boolean }) {
  const t = useT();
  const { shared } = useClubHighlights(clubId);
  // The day the page opened, read once (the card doesn't change while it's open).
  const [year] = useState(() => {
    const now = new Date();
    return clubYearShown(now) ?? (demo ? now.getFullYear() : null);
  });
  const summary = useMemo(
    () => (year === null ? null : clubYear({ posts, meetings, highlights: shared ?? [], upTo }, year)),
    [year, posts, meetings, shared, upTo],
  );
  if (!summary || summary.posts + summary.meetings + summary.highlights === 0) return null;
  return (
    <section className="goal-card club-year" aria-labelledby="club-year-title">
      <h2 id="club-year-title">{t("{year} together", { year: summary.year })}</h2>
      <ul className="club-year-facts">
        <li>{t.plural(summary.posts, { one: "{count} post", other: "{count} posts" })}</li>
        <li>{t.plural(summary.posters, { one: "{count} member posted", other: "{count} members posted" })}</li>
        <li>{t.plural(summary.meetings, { one: "{count} meeting held", other: "{count} meetings held" })}</li>
        <li>{t.plural(summary.highlights, { one: "{count} highlight shared", other: "{count} highlights shared" })}</li>
      </ul>
      {summary.busiestChapter !== null && (
        <p className="goal-hint">{t("Most talked about: {chapter}.", { chapter: chapterLabel(book, summary.busiestChapter) })}</p>
      )}
      <p className="goal-hint">{t("Counted only up to your chapter, so nothing ahead is spoiled.")}</p>
    </section>
  );
}
