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

/**
 * Highlights review in My Library → Notes: *Review N highlights* opens today's due highlights one
 * at a time (lib/highlightReview.ts), each with its book, chapter and note; *Still matters* moves
 * it on a step, *Again soon* brings it back tomorrow.
 */
export function HighlightReviewButton() {
  const review = useHighlightReview();
  const [open, setOpen] = useState(false);
  if (review.total === 0) return null;
  const n = review.due.length;
  return (
    <div className="highlight-review">
      {n > 0 ? (
        <button type="button" className="primary-button" onClick={() => setOpen(true)}>
          <Icon name="clock" size={17} /> Review {n} {n === 1 ? "highlight" : "highlights"}
        </button>
      ) : (
        <p className="muted">No highlights to review today.</p>
      )}
      <p className="field-hint">
        Each highlight comes back the day after you make it, then after {HIGHLIGHT_INTERVALS.join(", ").replace(/, (\d+)$/, " and $1")} days while it
        still matters, and every {HIGHLIGHT_INTERVALS[HIGHLIGHT_INTERVALS.length - 1]} days after that. Up to 10 a day.
      </p>
      <Dialog open={open} onClose={() => setOpen(false)} title="Review highlights" size="sm">
        {open && <Cards deck={review.due} onClose={() => setOpen(false)} onAnswer={review.answer} />}
      </Dialog>
    </div>
  );
}

function Cards({ deck: initial, onClose, onAnswer }: { deck: Highlight[]; onClose: () => void; onAnswer: (h: Highlight, stillMatters: boolean) => Promise<void> }) {
  // The deck as it was when the dialog opened, so answers don't reshuffle it.
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
        <p>
          That's all {deck.length} highlight{deck.length === 1 ? "" : "s"} for today.
        </p>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const book = getBook(card.bookId);
  const upload = uploads.find((u) => u.id === card.bookId);
  const title = book?.title ?? upload?.title ?? library[card.bookId]?.title ?? "Untitled book";
  const chapter = book?.chapters[card.chapterIndex]?.title ?? upload?.chapterTitles[card.chapterIndex] ?? `Chapter ${card.chapterIndex + 1}`;

  async function answer(stillMatters: boolean) {
    setError(null);
    setBusy(true);
    try {
      await onAnswer(card, stillMatters);
      setAt((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't save that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="practise-card">
      <p className="muted">
        Highlight {at + 1} of {deck.length}
      </p>
      <blockquote className={`highlight-quote highlight-review-quote quote-${card.color}`}>{card.quote}</blockquote>
      {card.note && (
        <p className="highlight-review-note">
          <strong>Your note:</strong> {card.note}
        </p>
      )}
      <p className="word-source">
        From{" "}
        <Link to={`/read/${card.bookId}`}>
          {title}, {chapter}
        </Link>
      </p>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary-button" disabled={busy} onClick={() => answer(false)}>
          Again soon
        </button>
        <button type="button" className="primary-button" disabled={busy} onClick={() => answer(true)}>
          Still matters
        </button>
      </div>
    </div>
  );
}
