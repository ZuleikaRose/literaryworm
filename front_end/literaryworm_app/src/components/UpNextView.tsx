import { useState } from "react";
import { Link } from "react-router-dom";
import { getBook } from "../data/books";
import { canQueue } from "../lib/upNext";
import { useUpNext } from "../lib/useUpNext";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

/** My Library → Up next: the listening queue, with Move up, Move down and Remove. */
export function UpNextView() {
  const upNext = useUpNext();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const books = upNext.queue.map((id) => getBook(id)).filter(canQueue);

  async function run(work: () => Promise<void>, done: string) {
    setError(null);
    try {
      await work();
      setAnnouncement(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't change Up next. Try again.");
    }
  }

  if (books.length === 0) {
    return (
      <div className="library-empty">
        <h2>Nothing in Up next</h2>
        <p>On an audiobook's page, choose Add to Up next. When a book finishes, the player offers the first one.</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="up-next-title">
      <div className="section-head">
        <div>
          <h2 id="up-next-title">Up next</h2>
          <p className="muted">
            {books.length} audiobook{books.length === 1 ? "" : "s"}, in the order they'll play.
          </p>
        </div>
      </div>
      {error && (
        <p className="form-alert" role="alert">
          <Icon name="alert" size={17} /> <span>{error}</span>
        </p>
      )}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      <ol className="up-next-list">
        {books.map((b, i) => (
          <li key={b.id} className="up-next-item">
            <span className="series-number" aria-hidden="true">
              {i + 1}
            </span>
            <Cover book={b} size="sm" />
            <div className="up-next-text">
              <Link to={`/books/${b.id}`}>{b.title}</Link>
              <span className="muted">{b.author}</span>
            </div>
            <div className="up-next-actions">
              <Link className="icon-button" to={`/listen/${b.id}`}>
                <Icon name="play" size={18} filled />
                <span className="visually-hidden">Listen to {b.title} now</span>
              </Link>
              <button type="button" className="icon-button" disabled={i === 0} onClick={() => run(() => upNext.move(b.id, -1), `${b.title} moved up.`)}>
                <Icon name="chevronDown" size={18} className="flip" />
                <span className="visually-hidden">Move {b.title} up</span>
              </button>
              <button type="button" className="icon-button" disabled={i === books.length - 1} onClick={() => run(() => upNext.move(b.id, 1), `${b.title} moved down.`)}>
                <Icon name="chevronDown" size={18} />
                <span className="visually-hidden">Move {b.title} down</span>
              </button>
              <button type="button" className="icon-button" onClick={() => run(() => upNext.remove(b.id), `${b.title} removed from Up next.`)}>
                <Icon name="close" size={18} />
                <span className="visually-hidden">Remove {b.title} from Up next</span>
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
