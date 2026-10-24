import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import {
  BookmarksDialog,
  ChaptersDialog,
  DailyLimitReached,
  FinishedPanel,
  MarkFinishedDialog,
  ReadingGate,
} from "../components/ReadingParts";
import {
  chapterAt,
  chapterTimes,
  CREDITS_SECONDS,
  chapterLabel,
  formatTime,
  PLAYBACK_SPEEDS,
  SKIP_SECONDS,
  SLEEP_MINUTES,
  type SleepTimer,
  spokenTime,
} from "../lib/reading";
import { useDailyLimit } from "../lib/useDailyLimit";
import { useReading } from "../lib/useReading";
import { useTitle } from "../lib/useTitle";
import { useProfileData, useStore } from "../store/context";
import type { Book } from "../types";

type Panel = "chapters" | "bookmarks" | null;

/** How often the sample clock ticks, and how often a playing book saves its place. */
const TICK_MS = 250;
const SAVE_EVERY_SECONDS = 15;

export default function Player() {
  return <ReadingGate format="audiobook">{(book) => <PlayerView key={book.id} book={book} />}</ReadingGate>;
}

function PlayerView({ book }: { book: Book }) {
  useTitle(`Listening to ${book.title}`);
  const { dispatch } = useStore();
  const speed = useProfileData().playbackSpeed;
  const reading = useReading(book);
  const { starts, total } = chapterTimes(book);

  const [position, setPosition] = useState(() =>
    reading.progress && !reading.progress.finished ? Math.min(total, reading.progress.fraction * total) : 0,
  );
  const [playing, setPlaying] = useState(false);
  const [sleep, setSleep] = useState<SleepTimer>(null);
  /** Seconds of playback left on a minutes sleep timer. */
  const [sleepLeft, setSleepLeft] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [asking, setAsking] = useState(false);
  const [finished, setFinished] = useState(false);
  const limit = useDailyLimit(playing);

  const chapterIndex = chapterAt(starts, position);
  const chapter = book.chapters[chapterIndex];
  const chapterStart = starts[chapterIndex];
  const chapterEnd = chapterStart + chapter.minutes * 60;
  const hereLabel = `Chapter ${chapterIndex + 1}, ${formatTime(position - chapterStart)}`;

  const save = (seconds: number, finishedNow = false) =>
    reading.save({
      format: "audiobook",
      fraction: finishedNow ? 1 : seconds / total,
      chapterIndex: chapterAt(starts, seconds),
      finished: finishedNow,
    });

  const seek = (seconds: number) => {
    const next = Math.min(total, Math.max(0, seconds));
    setPosition(next);
    save(next);
  };

  // The sample clock: no narration audio in this build, so time simply runs at the chosen speed.
  // It stops when paused or when the daily limit is reached, saving the place as it stops.
  const running = playing && !limit.reached;
  const clock = useRef({ position, speed, sleep, sleepLeft, chapterEnd, sinceSave: 0, save });
  useEffect(() => {
    clock.current = { ...clock.current, position, speed, sleep, sleepLeft, chapterEnd, save };
  });
  useEffect(() => {
    if (!running) return;
    const saveAt = (seconds: number, finishedNow?: boolean) => clock.current.save(seconds, finishedNow);
    const id = window.setInterval(() => {
      const c = clock.current;
      const step = (TICK_MS / 1000) * c.speed;
      const next = Math.min(total, c.position + step);
      c.sinceSave += step;

      if (c.sleep?.kind === "chapter" && next >= c.chapterEnd && c.position < c.chapterEnd) {
        c.position = c.chapterEnd;
        setPosition(c.chapterEnd);
        setSleep(null);
        setPlaying(false);
        setNotice("Sleep timer: paused at the end of the chapter.");
        return;
      }
      if (c.sleep?.kind === "minutes") {
        const left = c.sleepLeft - TICK_MS / 1000;
        if (left <= 0) {
          c.position = next;
          setPosition(next);
          setSleep(null);
          setPlaying(false);
          setNotice("Sleep timer: playback paused.");
          return;
        }
        c.sleepLeft = left;
        setSleepLeft(left);
      }
      if (next >= total) {
        // The natural end of the book finishes it; only a drag to the end asks first.
        c.position = total;
        setPosition(total);
        setPlaying(false);
        setFinished(true);
        saveAt(total, true);
        return;
      }
      c.position = next;
      setPosition(next);
      if (c.sinceSave >= SAVE_EVERY_SECONDS) {
        c.sinceSave = 0;
        saveAt(next);
      }
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
      const c = clock.current;
      if (c.position < total) saveAt(c.position);
    };
  }, [running, total]);

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
    } else {
      setNotice(null);
      if (position >= total) seek(0);
      setPlaying(true);
    }
  };

  // Space plays and pauses, arrows skip 15 seconds, unless a control that uses those keys has focus.
  const keys = useRef({ togglePlay, seek, position });
  useEffect(() => {
    keys.current = { togglePlay, seek, position };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea, button, a, dialog") || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = keys.current;
      if (e.key === " " || e.key === "k") k.togglePlay();
      else if (e.key === "ArrowLeft" || e.key === "j") k.seek(k.position - SKIP_SECONDS);
      else if (e.key === "ArrowRight" || e.key === "l") k.seek(k.position + SKIP_SECONDS);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (limit.reached && limit.limitMinutes !== null) {
    // Coming back with more time, the book waits paused rather than playing on by itself.
    const allowMore = () => {
      setPlaying(false);
      limit.allowMore();
    };
    return <DailyLimitReached limitMinutes={limit.limitMinutes} onAllowMore={allowMore} />;
  }

  const inOpeningCredits = position < CREDITS_SECONDS;
  const inClosingCredits = position >= total - CREDITS_SECONDS && position < total;
  const isHereMarked = reading.bookmarks.some((b) => b.format === "audiobook" && Math.abs(b.fraction * total - position) < 5);

  const chooseSleep = (value: string) => {
    setNotice(null);
    if (value === "off") setSleep(null);
    else if (value === "chapter") setSleep({ kind: "chapter" });
    else {
      setSleep({ kind: "minutes", minutes: Number(value) });
      setSleepLeft(Number(value) * 60);
    }
  };
  const sleepValue = sleep === null ? "off" : sleep.kind === "chapter" ? "chapter" : String(sleep.minutes);

  return (
    <div className="player">
      <header className="player-bar">
        <Link className="icon-button" to={`/books/${book.id}`}>
          <Icon name="arrowLeft" size={20} />
          <span className="visually-hidden">Close the player</span>
        </Link>
        <p className="player-eyebrow">Now listening</p>
        <div className="reader-tools">
          <button type="button" className="icon-button" onClick={() => setPanel("chapters")}>
            <Icon name="list" size={20} />
            <span className="visually-hidden">Chapters</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("bookmarks")}>
            <Icon name="bookmark" size={20} filled={isHereMarked} />
            <span className="visually-hidden">Bookmarks</span>
          </button>
        </div>
      </header>

      <main className="player-main">
        <div className="player-cover">
          <Cover book={book} size="xl" />
        </div>

        <div className="player-body">
          <div className="player-heading">
            <h1>{book.title}</h1>
            <p>
              {book.author}
              {book.narrator && <> · Narrated by {book.narrator}</>}
            </p>
            <p className="player-chapter">{chapterLabel(book, chapterIndex)}</p>
          </div>

          {reading.saveError && (
            <p className="reader-save-error" role="alert">
              <Icon name="alert" size={15} /> {reading.saveError}
            </p>
          )}

          {finished ? (
            <FinishedPanel
              book={book}
              onRestart={() => {
                setFinished(false);
                seek(0);
              }}
            />
          ) : (
            <>
              <div className="progress-track player-progress">
                <span className="chapter-marks" aria-hidden="true">
                  {starts.slice(1).map((start, i) => (
                    <span key={i} style={{ left: `${(start / total) * 100}%` }} />
                  ))}
                </span>
                <input
                  type="range"
                  className="progress-range"
                  min={0}
                  max={Math.round(total)}
                  step={1}
                  value={Math.round(position)}
                  aria-label="Position in the book"
                  aria-valuetext={`${spokenTime(position)} of ${spokenTime(total)}, ${chapter.title}`}
                  style={{ "--fill": `${(position / total) * 100}%` } as CSSProperties}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value >= Math.round(total)) {
                      // Dragging to the end asks first, so a stray drag doesn't finish the book.
                      setPlaying(false);
                      setPosition(total - 1);
                      setAsking(true);
                    } else seek(value);
                  }}
                />
              </div>
              <p className="player-times">
                <span>{formatTime(position)}</span>
                <span>
                  <span aria-hidden="true">−</span>
                  <span className="visually-hidden">Time left: </span>
                  {formatTime(total - position)}
                </span>
              </p>

              {(inOpeningCredits || inClosingCredits) && (
                <button
                  type="button"
                  className="secondary-button credits-button"
                  onClick={() => seek(inOpeningCredits ? CREDITS_SECONDS : total - 1)}
                >
                  {inOpeningCredits ? "Skip opening credits" : "Skip closing credits"}
                </button>
              )}

              <div className="player-controls">
                <button
                  type="button"
                  className="icon-button"
                  disabled={chapterIndex === 0 && position < 3}
                  onClick={() => seek(position - chapterStart > 3 ? chapterStart : starts[Math.max(0, chapterIndex - 1)])}
                >
                  <Icon name="previousChapter" size={20} />
                  <span className="visually-hidden">Previous chapter</span>
                </button>
                <button type="button" className="skip-button" onClick={() => seek(position - SKIP_SECONDS)}>
                  <Icon name="chevronLeft" size={18} />
                  <span aria-hidden="true">15</span>
                  <span className="visually-hidden">Back 15 seconds</span>
                </button>
                <button type="button" className="play-button" onClick={togglePlay}>
                  <Icon name={playing ? "pause" : "play"} size={30} filled />
                  <span className="visually-hidden">{playing ? "Pause" : "Play"}</span>
                </button>
                <button type="button" className="skip-button" onClick={() => seek(position + SKIP_SECONDS)}>
                  <span aria-hidden="true">15</span>
                  <Icon name="chevronRight" size={18} />
                  <span className="visually-hidden">Forward 15 seconds</span>
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={chapterIndex === book.chapters.length - 1}
                  onClick={() => seek(starts[chapterIndex + 1])}
                >
                  <Icon name="nextChapter" size={20} />
                  <span className="visually-hidden">Next chapter</span>
                </button>
              </div>

              <div className="player-settings">
                <label className="player-select">
                  <span>Speed</span>
                  <select value={speed} onChange={(e) => dispatch({ type: "setPlaybackSpeed", speed: Number(e.target.value) })}>
                    {PLAYBACK_SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {s}×
                      </option>
                    ))}
                  </select>
                </label>
                <label className="player-select">
                  <span>Sleep timer</span>
                  <select value={sleepValue} onChange={(e) => chooseSleep(e.target.value)}>
                    <option value="off">Off</option>
                    {SLEEP_MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                    <option value="chapter">End of chapter</option>
                  </select>
                </label>
              </div>

              <p className="player-status" role="status">
                {notice ??
                  (sleep?.kind === "minutes"
                    ? `Sleep timer: pauses after ${formatTime(sleepLeft)} more of playing`
                    : sleep?.kind === "chapter"
                      ? "Sleep timer: pauses at the end of this chapter"
                      : "")}
              </p>
            </>
          )}

          <p className="reader-sample-note">
            Sample player: this build has no narration audio, so the clock runs silently. Space plays and pauses; the left and
            right arrows skip 15 seconds.
          </p>
        </div>
      </main>

      <ChaptersDialog
        open={panel === "chapters"}
        onClose={() => setPanel(null)}
        book={book}
        current={chapterIndex}
        detail={(i) => formatTime(starts[i])}
        onPick={(i) => {
          setPanel(null);
          seek(starts[i]);
        }}
      />
      <BookmarksDialog
        open={panel === "bookmarks"}
        onClose={() => setPanel(null)}
        bookmarks={reading.bookmarks}
        hereLabel={hereLabel}
        isHereMarked={isHereMarked}
        onAdd={() => reading.addBookmark({ format: "audiobook", fraction: position / total, chapterIndex, label: hereLabel })}
        onGo={(b) => {
          setPanel(null);
          seek(b.fraction * total);
        }}
        onRemove={(b) => reading.removeBookmark(b.id)}
      />
      <MarkFinishedDialog
        open={asking}
        title={book.title}
        onFinish={() => {
          setAsking(false);
          setPosition(total);
          setFinished(true);
          save(total, true);
        }}
        onCancel={() => {
          setAsking(false);
          seek(total - CREDITS_SECONDS);
        }}
      />
    </div>
  );
}
