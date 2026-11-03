import { useState } from "react";
import { Link } from "react-router-dom";
import { getBook } from "../data/books";
import { HIGHLIGHT_INTERVALS } from "../lib/highlightReview";
import { useHighlightReview } from "../lib/useHighlightReview";
import { useProfileData, useStore } from "../store/context";
import { activeLibrary } from "../store/reducer";
import type { Highlight } from "../types";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";

/**
 * Highlights review in My Library → Notes: *Review N highlights* opens today's due highlights one
 * at a time (lib/highlightReview.ts), each with its book, chapter and note; *Still matters* moves
 * it on a step, *Again soon* brings it back tomorrow.
 */
export function HighlightReviewButton() {
  const t = useT();
  const review = useHighlightReview();
  const [open, setOpen] = useState(false);
  if (review.total === 0) return null;
  const n = review.due.length;
  return (
    <div className="highlight-review">
      {n > 0 ? (
        <button type="button" className="primary-button" onClick={() => setOpen(true)}>
          <Icon name="clock" size={17} /> {t.plural(n, { one: "Review {count} highlight", other: "Review {count} highlights" })}
        </button>
      ) : (
        <p className="muted">{t("No highlights to review today.")}</p>
      )}
      <p className="field-hint">
        {t("Each highlight comes back the day after you make it, then after {intervals} days while it still matters, and every {last} days after that. Up to 10 a day.", {
          intervals: t("{list} and {last}", { list: HIGHLIGHT_INTERVALS.slice(0, -1).join(", "), last: HIGHLIGHT_INTERVALS[HIGHLIGHT_INTERVALS.length - 1] }),
          last: HIGHLIGHT_INTERVALS[HIGHLIGHT_INTERVALS.length - 1],
        })}
      </p>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("Review highlights")} size="sm">
        {open && <Cards deck={review.due} onClose={() => setOpen(false)} onAnswer={review.answer} />}
      </Dialog>
    </div>
  );
}

function Cards({ deck: initial, onClose, onAnswer }: { deck: Highlight[]; onClose: () => void; onAnswer: (h: Highlight, stillMatters: boolean) => Promise<void> }) {
  // The deck as it was when the dialog opened, so answers don't reshuffle it.
  const t = useT();
  const [deck] = useState(initial);
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { state } = useStore();
  const library = activeLibrary(state);
  const { uploads } = useProfileData();
  const card = deck[at];

  if (!card) {
    return (
      <div className="practise-done" role="status">
        <p>{t.plural(deck.length, { one: "That's all {count} highlight for today.", other: "That's all {count} highlights for today." })}</p>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            {t("Done")}
          </button>
        </div>
      </div>
    );
  }

  const book = getBook(card.bookId);
  const upload = uploads.find((u) => u.id === card.bookId);
  const title = book?.title ?? upload?.title ?? library[card.bookId]?.title ?? t("Untitled book");
  const chapter = book?.chapters[card.chapterIndex]?.title ?? upload?.chapterTitles[card.chapterIndex] ?? t("Chapter {n}", { n: card.chapterIndex + 1 });

  async function answer(stillMatters: boolean) {
    setError(null);
    setBusy(true);
    try {
      await onAnswer(card, stillMatters);
      setAt((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't save that. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="practise-card">
      <p className="muted">
        {t("Highlight {n} of {total}", { n: at + 1, total: deck.length })}
      </p>
      <blockquote className={`highlight-quote highlight-review-quote quote-${card.color}`}>{card.quote}</blockquote>
      {card.note && (
        <p className="highlight-review-note">
          <strong>{t("Your note:")}</strong> {card.note}
        </p>
      )}
      <p className="word-source">
        {rich(t("From {place}"), {
          place: (
            <Link to={`/read/${card.bookId}?chapter=${card.chapterIndex}&page=${card.page}`}>
              {title}, {chapter}
            </Link>
          ),
        })}
      </p>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => answer(false)}>
          {t("Again soon")}
        </button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => answer(true)}>
          {t("Still matters")}
        </button>
      </div>
    </div>
  );
}
