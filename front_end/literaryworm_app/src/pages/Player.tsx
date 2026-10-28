import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { Transcript } from "../components/Transcript";
import { accentOf, LIBRIVOX_VOICE, resolveNarration, SILENT_VOICE, useVoices, voiceLabel } from "../lib/narration";
import { usePlayback } from "../lib/playback";
import {
  chapterAt,
  chapterTimes,
  CREDITS_SECONDS,
  chapterLabel,
  formatTime,
  PLAYBACK_SPEEDS,
  SKIP_SECONDS,
  SLEEP_MINUTES,
  spokenTime,
} from "../lib/reading";
import { useTitle } from "../lib/useTitle";
import { useProfileData, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { Book } from "../types";

type Panel = "chapters" | "bookmarks" | null;

export default function Player() {
  return <ReadingGate format="audiobook">{(book) => <PlayerView key={book.id} book={book} />}</ReadingGate>;
}

function PlayerView({ book }: { book: Book }) {
  useTitle(`Listening to ${book.title}`);
  const { state, dispatch } = useStore();
  const { playbackSpeed: speed, narrationVoice } = useProfileData();
  const voices = useVoices();
  const narration = resolveNarration(book, narrationVoice, voices);
  const voiceValue = narration.kind === "speech" ? narration.voice.voiceURI : narration.kind === "recording" ? LIBRIVOX_VOICE : SILENT_VOICE;
  const accents = (["British", "American", "Australian"] as const)
    .map((accent) => [accent, voices.filter((v) => accentOf(v) === accent)] as const)
    .filter(([, list]) => list.length > 0);
  const playback = usePlayback();
  const { open } = playback;
  const { starts, total } = chapterTimes(book);
  const bookmarks = activeReading(state)
    .bookmarks.filter((b) => b.bookId === book.id)
    .sort((a, b) => a.fraction - b.fraction);
  const [panel, setPanel] = useState<Panel>(null);
  const [asking, setAsking] = useState(false);

  // The book plays through the app-wide engine, so it keeps playing in the mini-player after
  // this page closes.
  useLayoutEffect(() => {
    open(book);
  }, [open, book]);

  const live = playback.snapshot?.bookId === book.id ? playback.snapshot : null;
  const position = live?.position ?? 0;
  const playing = live?.playing ?? false;
  const finished = live?.finished ?? false;
  const sleep = live?.sleep ?? null;

  const chapterIndex = chapterAt(starts, position);
  const chapter = book.chapters[chapterIndex];
  const chapterStart = starts[chapterIndex];
  const hereLabel = `Chapter ${chapterIndex + 1}, ${formatTime(position - chapterStart)}`;
  const seek = playback.seek;

  // Space plays and pauses, arrows skip 15 seconds, unless a control that uses those keys has focus.
  const keys = useRef({ toggle: playback.toggle, seek, position });
  useEffect(() => {
    keys.current = { toggle: playback.toggle, seek, position };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea, button, a, dialog, [role=button]") || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = keys.current;
      if (e.key === " " || e.key === "k") k.toggle();
      else if (e.key === "ArrowLeft" || e.key === "j") k.seek(k.position - SKIP_SECONDS);
      else if (e.key === "ArrowRight" || e.key === "l") k.seek(k.position + SKIP_SECONDS);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!live) return <div className="player" aria-busy="true" />;

  if (live.limitReached && live.limitMinutes !== null) {
    return <DailyLimitReached limitMinutes={live.limitMinutes} onAllowMore={playback.allowMore} />;
  }

  const inOpeningCredits = position < CREDITS_SECONDS;
  const inClosingCredits = position >= total - CREDITS_SECONDS && position < total;
  const isHereMarked = bookmarks.some((b) => b.format === "audiobook" && Math.abs(b.fraction * total - position) < 5);
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
          {!book.recording && (
            <button
              type="button"
              className="icon-button"
              aria-pressed={state.a11y.transcript}
              onClick={() => dispatch({ type: "updateA11y", patch: { transcript: !state.a11y.transcript } })}
            >
              <Icon name="subtitles" size={20} />
              <span className="visually-hidden">Read-along transcript</span>
            </button>
          )}
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

          {live.saveError && (
            <p className="reader-save-error" role="alert">
              <Icon name="alert" size={15} /> {live.saveError}
            </p>
          )}

          {finished ? (
            <FinishedPanel book={book} onRestart={playback.restart} />
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
                      playback.pause();
                      seek(total - 1);
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
                <button type="button" className="play-button" onClick={playback.toggle}>
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
                  <select value={sleepValue} onChange={(e) => playback.setSleep(e.target.value)}>
                    <option value="off">Off</option>
                    {SLEEP_MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m} minutes
                      </option>
                    ))}
                    <option value="chapter">End of chapter</option>
                  </select>
                </label>
                <label className="player-select player-voice">
                  <span>Voice</span>
                  <select value={voiceValue} onChange={(e) => dispatch({ type: "setNarrationVoice", voice: e.target.value })}>
                    {book.recording && <option value={LIBRIVOX_VOICE}>Original narrator: {book.recording.narrator}</option>}
                    {accents.map(([accent, list]) => (
                      <optgroup key={accent} label={`${accent} English`}>
                        {list.map((v) => (
                          <option key={v.voiceURI} value={v.voiceURI}>
                            {voiceLabel(v)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {!book.recording && <option value={SILENT_VOICE}>No voice (silent sample)</option>}
                  </select>
                </label>
              </div>

              <p className="player-status" role="status">
                {live.notice ??
                  (sleep?.kind === "minutes"
                    ? `Sleep timer: pauses after ${formatTime(live.sleepLeft)} more of playing`
                    : sleep?.kind === "chapter"
                      ? "Sleep timer: pauses at the end of this chapter"
                      : "")}
              </p>
            </>
          )}

          <p className="reader-sample-note">
            {narration.kind === "recording" && book.recording ? (
              <>
                Narrated by {book.recording.narrator} for{" "}
                <a href={book.recording.page} target="_blank" rel="noreferrer">
                  LibriVox<span className="visually-hidden"> (opens in a new tab)</span>
                </a>
                : a public-domain recording, streamed from the Internet Archive.
              </>
            ) : narration.kind === "speech" ? (
              book.recording ? (
                <>Read aloud by your device's {voiceLabel(narration.voice)} voice from the full public-domain text (Project Gutenberg).</>
              ) : (
                <>Read aloud by your device's {voiceLabel(narration.voice)} voice from sample text: this title's narration isn't licensed yet.</>
              )
            ) : (
              <>Sample player: this title's narration isn't licensed yet, so the clock runs silently.</>
            )}{" "}
            {voices.length < 10 &&
              (voices.length === 0
                ? "This browser has no English voices to read aloud with."
                : `This device has ${voices.length} English ${voices.length === 1 ? "voice" : "voices"}; Edge, Safari and phones usually offer more.`)}{" "}
            Space plays and pauses; the left and right arrows skip 15 seconds. Leave the player and the book keeps playing in
            the mini-player.
          </p>
        </div>

        {/* A real recording has no sentence timings, so its book shows no transcript; a device voice reading the real text does. */}
        {state.a11y.transcript && !finished && (!book.recording || narration.kind === "speech") && (
          <Transcript book={book} chapterIndex={chapterIndex} position={position} onSeek={seek} realText={Boolean(book.recording)} />
        )}
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
        bookmarks={bookmarks}
        hereLabel={hereLabel}
        isHereMarked={isHereMarked}
        onAdd={() => playback.addBookmark({ format: "audiobook", fraction: position / total, chapterIndex, label: hereLabel })}
        onGo={(b) => {
          setPanel(null);
          seek(b.fraction * total);
        }}
        onRemove={(b) => playback.removeBookmark(b.id)}
      />
      <MarkFinishedDialog
        open={asking}
        title={book.title}
        onFinish={() => {
          setAsking(false);
          playback.finish();
        }}
        onCancel={() => {
          setAsking(false);
          seek(total - CREDITS_SECONDS);
        }}
      />
    </div>
  );
}
