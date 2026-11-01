import { Link } from "react-router-dom";
import { getBook } from "../data/books";
import { planToday, statusText } from "../lib/readingPlans";
import { today } from "../lib/reading";
import { useReadingPlans } from "../lib/useReadingPlans";
import { useStore } from "../store/context";
import { activeLibrary, activeReading } from "../store/reducer";
import { Icon } from "./Icon";

/**
 * Home's *Your reading plans*: each unfinished plan with its days left and whether it's on track,
 * linking to the book page, which has the day's share at the reader's own pace.
 */
export function ReadingPlansCard() {
  const reading = useReadingPlans();
  const { state } = useStore();
  const progress = activeReading(state).progress;
  const library = activeLibrary(state);
  const now = today();
  const rows = (reading.plans ?? [])
    .map((plan) => {
      const place = progress[plan.bookId];
      const book = getBook(plan.bookId);
      const t = planToday(plan, { pages: book?.pages ?? 0 }, place?.finished ? 1 : (place?.fraction ?? plan.startFraction), now, null, null);
      return { plan, t, title: book?.title ?? library[plan.bookId]?.title ?? "A book" };
    })
    .filter((r) => r.t.status !== "done");
  if (rows.length === 0) return null;

  return (
    <section className="reading-plans-card" aria-labelledby="reading-plans-title">
      <h2 id="reading-plans-title">
        <Icon name="calendar" size={18} /> Your reading plans
      </h2>
      <ul role="list">
        {rows.map(({ plan, t, title }) => (
          <li key={plan.bookId}>
            <Link to={`/books/${plan.bookId}`}>{title}</Link>
            <span className="muted">
              {t.status === "overdue" ? "" : `${t.daysLeft === 1 ? "Last day" : `${t.daysLeft} days left`} · `}
              <span className={`plan-status plan-${t.status}`}>{statusText(t)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
