import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { usePlayback } from "../lib/playback";
import { chapterAt, chapterTimes, formatTime, SKIP_SECONDS } from "../lib/reading";
import { Cover } from "./Cover";
import { Icon } from "./Icon";

/**
 * The audiobook that's playing, at the bottom of every page (above the tab bar on phones), so
 * it keeps playing while the member browses. The title opens the full player.
 */
export function MiniPlayer() {
  const { book, snapshot, toggle, seek, close } = usePlayback();
  if (!book || !snapshot) return null;

  const { starts } = chapterTimes(book);
  const chapterIndex = chapterAt(starts, snapshot.position);
  const chapterEnd = starts[chapterIndex] + book.chapters[chapterIndex].minutes * 60;
  const left = chapterEnd - snapshot.position;
  const status = snapshot.limitReached ? (
    "Today's listening time is used up"
  ) : snapshot.finished ? (
    "Finished"
  ) : (
    <>
      Chapter {chapterIndex + 1} · <span aria-hidden="true">−</span>
      {formatTime(left)}
      <span className="visually-hidden"> left in the chapter</span>
    </>
  );

  return (
    <section className="mini-player" aria-label="Now playing">
      <span className="mini-progress" aria-hidden="true" style={{ "--fill": `${(snapshot.position / snapshot.total) * 100}%` } as CSSProperties} />
      <Link className="mini-info" to={`/listen/${book.id}`}>
        <Cover book={book} size="sm" className="mini-cover" />
        <span className="mini-text">
          <strong>{book.title}</strong>
          <small>{status}</small>
        </span>
        <span className="visually-hidden">. Open the player</span>
      </Link>
      <div className="mini-controls">
        <button type="button" className="icon-button mini-skip" disabled={snapshot.limitReached} onClick={() => seek(snapshot.position - SKIP_SECONDS)}>
          <Icon name="skipBack" size={20} />
          <span className="visually-hidden">Back 15 seconds</span>
        </button>
        <button type="button" className="mini-play" disabled={snapshot.limitReached} onClick={toggle}>
          <Icon name={snapshot.playing ? "pause" : "play"} size={20} filled />
          <span className="visually-hidden">{snapshot.playing ? "Pause" : "Play"}</span>
        </button>
        <button type="button" className="icon-button" onClick={close}>
          <Icon name="close" size={18} />
          <span className="visually-hidden">Close the mini-player</span>
        </button>
      </div>
      <p className="visually-hidden" role="status">
        {snapshot.notice ?? ""}
      </p>
    </section>
  );
}
