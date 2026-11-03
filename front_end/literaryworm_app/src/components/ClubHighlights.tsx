import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { shareable, shareLabel, splitShared } from "../lib/clubHighlights";
import { useClubHighlights } from "../lib/useClubHighlights";
import { rich } from "../lib/i18n";
import { useT } from "../lib/useT";
import type { Book } from "../types";
import { Icon } from "./Icon";

/**
 * Shared highlights on a club's page (lib/clubHighlights.ts): what members highlighted in the
 * club's book, with their notes if they chose to share them. Chapters past the reader's place stay
 * hidden until they choose to see them, like posts. A member shares one of their own highlights of
 * the book from the list here, and can stop sharing it.
 */
export function ClubHighlights({ clubId, book, me, myName, upTo }: { clubId: string; book: Book; me: string; myName: string; upTo: number }) {
  const t = useT();
  const club = useClubHighlights(clubId);
  const [showHidden, setShowHidden] = useState(false);
  const [picked, setPicked] = useState("");
  const [withNote, setWithNote] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const id = useId();

  const chapterTitle = (i: number) => book.chapters[i]?.title ?? t("Chapter {n}", { n: i + 1 });
  const shared = club.shared ?? [];
  // Your own shares are never hidden from you.
  const { visible, hidden } = splitShared(
    shared.filter((h) => h.userId !== me),
    upTo,
  );
  const yours = shared.filter((h) => h.userId === me);
  const options = shareable(club.mine, shared, book.id);
  const chosen = options.find((h) => h.id === picked) ?? options[0];

  async function run(work: () => Promise<void>, done: string) {
    setError(null);
    setBusy(true);
    try {
      await work();
      setStatus(done);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Something went wrong. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const item = (h: (typeof shared)[number], mineToo: boolean) => (
    <li key={h.id} className="club-highlight">
      <p className="club-post-meta">
        {rich(t("{name} on {chapter}"), { name: <strong>{mineToo ? t("You") : h.author}</strong>, chapter: chapterTitle(h.chapterIndex) })}
      </p>
      <blockquote className={`highlight-quote quote-${h.color}`}>{h.quote}</blockquote>
      {h.note && <p className="club-highlight-note">{h.note}</p>}
      {mineToo && (
        <button type="button" className="text-button" disabled={busy} onClick={() => run(() => club.unshare(h.id), t("Stopped sharing that highlight."))}>
          {t("Stop sharing")}<span className="visually-hidden"> {t("this highlight")}</span>
        </button>
      )}
    </li>
  );

  return (
    <section className="club-highlights" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t("Shared highlights")}</h2>
      <p className="goal-hint">{t("Passages members marked in the book. Ones from chapters you haven't reached stay hidden.")}</p>
      {club.error && (
        <p className="form-alert" role="alert">
          <Icon name="alert" size={17} /> <span>{club.error}</span>
        </p>
      )}
      {club.shared === null && !club.error && <p className="muted">{t("Loading…")}</p>}
      {club.shared !== null && visible.length + hidden.length + yours.length === 0 && <p className="muted">{t("No one has shared a highlight yet.")}</p>}

      {(visible.length > 0 || yours.length > 0) && (
        <ul className="club-highlight-list" role="list">
          {visible.map((h) => item(h, false))}
              {yours.map((h) => item(h, true))}
        </ul>
      )}
      {hidden.length > 0 && !showHidden && (
        <p className="club-spoiler">
          {t.plural(hidden.length, { one: "{count} more is from chapters you haven't reached.", other: "{count} more are from chapters you haven't reached." })}{" "}
          <button type="button" className="text-button" onClick={() => setShowHidden(true)}>
            {hidden.length === 1 ? t("Show it anyway") : t("Show them anyway")}
          </button>
        </p>
      )}
      {showHidden && hidden.length > 0 && (
        <ul className="club-highlight-list" role="list">
          {hidden.map((h) => item(h, false))}
        </ul>
      )}

      <div className="club-highlight-share">
        <h3>{t("Share one of yours")}</h3>
        {options.length === 0 ? (
          <p className="muted">
            {club.mine.some((h) => h.bookId === book.id)
              ? t("You've shared all your highlights of this book.")
              : rich(t("Highlight a passage in {title} and it can be shared here."), { title: <Link to={`/read/${book.id}`}>{book.title}</Link> })}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (chosen) run(() => club.share(chosen, withNote && !!chosen.note, myName), t("Shared with the club.")).then(() => setPicked(""));
            }}
          >
            <label htmlFor={`${id}-pick`}>{t("Highlight")}</label>
            <select id={`${id}-pick`} value={chosen?.id ?? ""} onChange={(e) => setPicked(e.target.value)}>
              {options.map((h) => (
                <option key={h.id} value={h.id}>
                  {shareLabel(h, chapterTitle(h.chapterIndex))}
                </option>
              ))}
            </select>
            {chosen?.note && (
              <label className="checkbox-row">
                <input type="checkbox" checked={withNote} onChange={(e) => setWithNote(e.target.checked)} /> {t("Include my note")}
              </label>
            )}
            <button type="submit" className="secondary-button" disabled={busy}>
              <Icon name="highlighter" size={16} /> {t("Share with the club")}
            </button>
          </form>
        )}
      </div>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {status}
      </p>
    </section>
  );
}
