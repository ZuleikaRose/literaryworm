import { type CSSProperties, type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBook } from "../data/books";
import { useUploadedBook } from "../lib/uploads";
import type { ListeningDevice } from "../lib/devicesApi";
import { bookText } from "../lib/narration";
import { usePlayback } from "../lib/playback";
import { startCast, useCast } from "../lib/cast";
import { chapterIntro, chapterOutro, type IndexEntry, parseTime, searchText } from "../lib/playerNav";
import { formatTime, PLAYBACK_SPEEDS, SKIP_CHOICES, SLEEP_MINUTES, SLEEP_MORE_MINUTES, spokenTime } from "../lib/reading";
import type { PlayerControls } from "../lib/usePlayerControls";
import { usePlayerSettings } from "../lib/usePlayerSettings";
import { useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { Book } from "../types";
import { Dialog } from "./Dialog";
import { Field } from "./Field";
import { Icon } from "./Icon";
import { rich, tk } from "../lib/i18n";
import { useT } from "../lib/useT";
import { CastChoices } from "./CastChoices";
import { Pronunciations } from "./Pronunciations";

/**
 * Controls the player page and the mini-player share: volume, Go to (contents, index,
 * references, a time), player settings, listening on another device, and the prompt that
 * offers a book sent here from another device.
 */

/**
 * After the sleep timer paused the book: one tap plays on for another few minutes (from a little
 * earlier, like Play). Shows nothing otherwise.
 */
export function SleepMore({ className }: { className?: string }) {
  const playback = usePlayback();
  const t = useT();
  const live = playback.snapshot;
  if (!live || live.playing || live.sleptAt === null) return null;
  return (
    <button
      type="button"
      className={`secondary-button sleep-more${className ? ` ${className}` : ""}`}
      onClick={() => {
        playback.setSleep(String(SLEEP_MORE_MINUTES));
        playback.play();
      }}
    >
      <Icon name="play" size={16} /> {t("{n} more minutes", { n: SLEEP_MORE_MINUTES })}
    </button>
  );
}

/** Mute and a volume slider. */
export function VolumeControl({ className }: { className?: string }) {
  const { player, update, toggleMute } = usePlayerSettings();
  const t = useT();
  const level = player.muted ? 0 : player.volume;
  return (
    <div className={`volume-control${className ? ` ${className}` : ""}`}>
      <button type="button" className="icon-button" aria-pressed={player.muted} onClick={toggleMute}>
        <Icon name={level === 0 ? "volumeMuted" : "volume"} size={20} />
        <span className="visually-hidden">{t("Mute")}</span>
      </button>
      <input
        type="range"
        className="volume-range"
        min={0}
        max={100}
        step={5}
        value={level}
        aria-label={t("Volume")}
        aria-valuetext={player.muted ? t("Muted") : `${player.volume}%`}
        style={{ "--fill": `${level}%` } as CSSProperties}
        onChange={(e) => update({ volume: Number(e.target.value), muted: false })}
      />
    </div>
  );
}

export type JumpSection = "contents" | "index" | "references" | "time";

const SECTIONS: { value: JumpSection; label: string }[] = [
  { value: "contents", label: tk("Contents") },
  { value: "index", label: tk("Index") },
  { value: "references", label: tk("References") },
  { value: "time", label: tk("Time") },
];

/** Go to a chapter (table of contents), to where words are read (index), a marked place (references) or a time. */
export function JumpDialog({
  open,
  onClose,
  book,
  controls,
  section,
  onSection,
}: {
  open: boolean;
  onClose: () => void;
  book: Book;
  controls: PlayerControls;
  section: JumpSection;
  onSection: (section: JumpSection) => void;
}) {
  const { seek } = usePlayback();
  const go = (seconds: number) => {
    onClose();
    seek(seconds);
  };
  const name = useId();
  const t = useT();

  return (
    <Dialog open={open} onClose={onClose} title={t("Go to")} eyebrow={book.title}>
      <fieldset className="segmented jump-sections">
        <legend className="visually-hidden">{t("Go to")}</legend>
        <div>
          {SECTIONS.map((s) => (
            <label key={s.value}>
              <input type="radio" name={name} value={s.value} checked={section === s.value} onChange={() => onSection(s.value)} />
              <span>{t(s.label)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {section === "contents" && <Contents book={book} controls={controls} onGo={go} />}
      {section === "index" && <BookIndex book={book} controls={controls} onGo={go} />}
      {section === "references" && <References book={book} controls={controls} onGo={go} />}
      {section === "time" && <GoToTime total={controls.total} onGo={go} />}
    </Dialog>
  );
}

function Contents({ book, controls, onGo }: { book: Book; controls: PlayerControls; onGo: (seconds: number) => void }) {
  const { starts, places, player } = controls;
  const t = useT();
  return (
    <ol className="chapter-list" aria-label={t("Table of contents")}>
      {book.chapters.map((chapter, i) => (
        <li key={i}>
          <button
            type="button"
            aria-current={i === places.chapterIndex ? "true" : undefined}
            onClick={() => onGo(starts[i] + (player.autoSkipIntro ? chapterIntro(book, i) : 0))}
          >
            <span className="chapter-number" aria-hidden="true">
              {i + 1}
            </span>
            <span className="chapter-name">{chapter.title}</span>
            <span className="chapter-detail">{formatTime(starts[i])}</span>
            {i === places.chapterIndex && <span className="visually-hidden"> {t("(current chapter)")}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}

type TextState = { status: "loading" } | { status: "ready"; chapters: string[] } | { status: "error"; message: string };

/** Find a word or name and go to where it's read. */
function BookIndex({ book, controls, onGo }: { book: Book; controls: PlayerControls; onGo: (seconds: number) => void }) {
  const [text, setText] = useState<TextState>({ status: "loading" });
  const [query, setQuery] = useState("");
  const t = useT();
  const lengths = useMemo(() => book.chapters.map((c) => c.minutes * 60), [book]);

  useEffect(() => {
    let live = true;
    bookText(book).then(
      (chapters) => live && setText({ status: "ready", chapters }),
      (err: Error) => live && setText({ status: "error", message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [book]);

  const results: IndexEntry[] = text.status === "ready" ? searchText(text.chapters, controls.starts, lengths, query) : [];
  const searched = query.trim().length >= 2;

  return (
    <div className="jump-index">
      <Field
        label={t("Find words in the book")}
        type="search"
        value={query}
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        hint={
          book.recording
            ? t("Searches the full text. Times are close to where the words are read.")
            : t("This title has sample text only, so the index covers the sample. Times are approximate.")
        }
      />
      {text.status === "loading" && <p className="muted">{t("Loading the book's text…")}</p>}
      {text.status === "error" && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {text.message}
        </p>
      )}
      <p className="visually-hidden" role="status">
        {searched && text.status === "ready" ? (results.length === 50 ? t("50 or more places found") : t.plural(results.length, { one: "{count} places found", other: "{count} places found" })) : ""}
      </p>
      {searched && text.status === "ready" && results.length === 0 && <p className="muted">{t("Nothing found for “{query}”.", { query: query.trim() })}</p>}
      {results.length > 0 && (
        <ul className="index-list">
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => onGo(r.at)}>
                <span className="index-place">
                  {t("Chapter {n}", { n: r.chapterIndex + 1 })} · {formatTime(r.at)}
                </span>
                <span className="index-snippet">
                  {r.before}
                  <mark>{r.match}</mark>
                  {r.after}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Places marked in the book: the credits and the profile's bookmarks, in order. */
function References({ book, controls, onGo }: { book: Book; controls: PlayerControls; onGo: (seconds: number) => void }) {
  const { state } = useStore();
  const { addBookmark } = usePlayback();
  const { starts, total, position, places } = controls;
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = useT();
  const bookmarks = activeReading(state).bookmarks.filter((b) => b.bookId === book.id);
  const last = book.chapters.length - 1;
  const opening = chapterIntro(book, 0);
  const closing = chapterOutro(book, last);
  const items = [
    ...(opening > 0 ? [{ key: "opening", label: t("Opening credits"), at: 0 }] : []),
    ...bookmarks.map((b) => ({ key: b.id, label: b.label, at: b.fraction * total })),
    ...(closing > 0 ? [{ key: "closing", label: t("Closing credits"), at: total - closing }] : []),
  ].sort((a, b) => a.at - b.at);
  const hereLabel = `Chapter ${places.chapterIndex + 1}, ${formatTime(position - starts[places.chapterIndex])}`;
  const marked = bookmarks.some((b) => Math.abs(b.fraction * total - position) < 5);

  const mark = async () => {
    setError(null);
    setSaving(true);
    try {
      await addBookmark({ format: "audiobook", fraction: position / total, chapterIndex: places.chapterIndex, label: hereLabel });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't add the bookmark. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="jump-references">
      <button type="button" className="secondary-button" disabled={marked || saving} onClick={mark}>
        <Icon name="bookmark" size={16} filled={marked} />
        {marked ? t("This place is bookmarked") : t("Bookmark {place}", { place: hereLabel })}
      </button>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <ul className="index-list">
        {items.map((item) => (
          <li key={item.key}>
            <button type="button" onClick={() => onGo(item.at)}>
              <span className="index-place">{formatTime(item.at)}</span>
              <span className="index-snippet">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {bookmarks.length === 0 && <p className="muted">{t("Bookmarks you add show here too.")}</p>}
    </div>
  );
}

function GoToTime({ total, onGo }: { total: number; onGo: (seconds: number) => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const seconds = parseTime(value);
    if (seconds === null) return setError(t("Enter a time like 1:05:30 or 12:40."));
    if (seconds >= total) return setError(t("The book is {length} long. Enter an earlier time.", { length: formatTime(total) }));
    onGo(seconds);
  };
  return (
    <form className="jump-time" onSubmit={submit} noValidate>
      <Field
        label={t("Time from the start")}
        inputMode="numeric"
        autoComplete="off"
        placeholder="1:05:30"
        value={value}
        error={error}
        hint={t("Hours, minutes and seconds. The book is {length} long.", { length: spokenTime(total) })}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
      />
      <button type="submit" className="primary-button">
        {t("Go")}
      </button>
    </form>
  );
}

/**
 * Skip lengths and skipping intros and outros; with `withPlayback`, speed and the sleep timer
 * too (the mini-player has no room for them).
 */
export function PlayerSettingsDialog({ open, onClose, withPlayback = false }: { open: boolean; onClose: () => void; withPlayback?: boolean }) {
  const playback = usePlayback();
  const { player, update, ownSpeed, setOwnSpeed } = usePlayerSettings(playback.book?.id ?? null);
  const sleep = playback.snapshot?.sleep ?? null;
  const sleepValue = sleep === null ? "off" : sleep.kind === "chapter" ? "chapter" : String(sleep.minutes);
  const t = useT();

  return (
    <Dialog open={open} onClose={onClose} title={t("Player settings")} size="sm">
      <div className="player-settings-form">
        {withPlayback && (
          <>
            <label className="player-select">
              <span>{t("Speed")}</span>
              <select value={player.speed} onChange={(e) => update({ speed: Number(e.target.value) })}>
                {PLAYBACK_SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </label>
            <label className="player-select">
              <span>{t("Sleep timer")}</span>
              <select value={sleepValue} onChange={(e) => playback.setSleep(e.target.value)}>
                <option value="off">{t("Off")}</option>
                {SLEEP_MINUTES.map((m) => (
                  <option key={m} value={m}>
                    {t("{m} minutes", { m })}
                  </option>
                ))}
                <option value="chapter">{t("End of chapter")}</option>
              </select>
            </label>
          </>
        )}
        <label className="player-select">
          <span>{t("Skip back")}</span>
          <select value={player.skipBack} onChange={(e) => update({ skipBack: Number(e.target.value) })}>
            {SKIP_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s} seconds
              </option>
            ))}
          </select>
        </label>
        <label className="player-select">
          <span>{t("Skip forward")}</span>
          <select value={player.skipForward} onChange={(e) => update({ skipForward: Number(e.target.value) })}>
            {SKIP_CHOICES.map((s) => (
              <option key={s} value={s}>
                {s} seconds
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="switch-list">
        {playback.book && (
          <li>
            <label className="switch-row">
              <span>
                <strong>{t("Keep this speed for this book")}</strong>
                <small>{t("This book plays at {speed}× from now on; other books keep your usual speed.", { speed: player.speed })}</small>
              </span>
              <input type="checkbox" role="switch" className="switch" checked={ownSpeed} onChange={(e) => setOwnSpeed(e.target.checked)} />
            </label>
          </li>
        )}
        <li>
          <label className="switch-row">
            <span>
              <strong>{t("Skip intros")}</strong>
              <small>{t("Start each chapter after its spoken introduction.")}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={player.autoSkipIntro}
              onChange={(e) => update({ autoSkipIntro: e.target.checked })}
            />
          </label>
        </li>
        <li>
          <label className="switch-row">
            <span>
              <strong>{t("Skip outros")}</strong>
              <small>{t("Move on before each chapter's closing announcement.")}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={player.autoSkipOutro}
              onChange={(e) => update({ autoSkipOutro: e.target.checked })}
            />
          </label>
        </li>
        <li>
          <label className="switch-row">
            <span>
              <strong>{t("Character voices")}</strong>
              <small>{t("With a natural voice on your uploads, what the characters say is read by other voices. Each named speaker keeps one voice.")}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={player.characterVoices}
              onChange={(e) => update({ characterVoices: e.target.checked })}
            />
          </label>
        </li>
        {player.characterVoices && playback.book?.upload && (
          <li>
            <CastChoices book={playback.book} />
          </li>
        )}
        {playback.book?.upload && (
          <li>
            <Pronunciations book={playback.book} />
          </li>
        )}
      </ul>
    </Dialog>
  );
}

type DeviceList = { status: "loading" } | { status: "ready"; devices: ListeningDevice[] } | { status: "error"; message: string };

/** Send the open book, at its place, to another of the account's open devices. */
export function DevicesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("Listen on another device")} size="sm">
      {open && <DevicesBody onClose={onClose} />}
    </Dialog>
  );
}

function DevicesBody({ onClose }: { onClose: () => void }) {
  const { book, link } = usePlayback();
  const [list, setList] = useState<DeviceList>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  // The list is read when the dialog opens and when Refresh is pressed.
  const listDevices = useRef(link.listDevices);
  useEffect(() => {
    listDevices.current = link.listDevices;
  });
  useEffect(() => {
    if (!link.available) return;
    let live = true;
    listDevices.current().then(
      (devices) => live && setList({ status: "ready", devices }),
      (err: Error) => live && setList({ status: "error", message: err.message }),
    );
    return () => {
      live = false;
    };
  }, [link.available, attempt]);

  if (!link.available) {
    return (
      <p className="modal-description">
        {t("Sign in with your member account on both devices, then send what you're listening to from one to the other. The demo household lives on this device only.")}
      </p>
    );
  }

  const send = async (device: ListeningDevice) => {
    setError(null);
    setSending(device.id);
    try {
      await link.sendTo(device);
      setSent(device.label);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("We couldn't send the book. Try again."));
    } finally {
      setSending(null);
    }
  };

  if (sent) {
    return (
      <>
        <p className="modal-description" role="status">
          {rich(
            book
              ? t("Sent {title} to {device}, and paused here. Choose {listen} on {device} to carry on.", { title: book.title, device: sent })
              : t("Sent to {device}, and paused here. Choose {listen} on {device} to carry on.", { device: sent }),
            { listen: <strong>{t("Listen here")}</strong> },
          )}
        </p>
        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            {t("Done")}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="devices">
      <p className="modal-description">
        {t("Pick up where you are on another device signed in to this account. This is {device}.", { device: link.thisDevice })}
      </p>
      {list.status === "loading" && <p className="muted">{t("Looking for your devices…")}</p>}
      {list.status === "error" && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {list.message}
        </p>
      )}
      {list.status === "ready" && list.devices.length === 0 && (
        <p className="muted">{t("No other devices are open. Open LiteraryWorm on another device, sign in, then refresh.")}</p>
      )}
      {list.status === "ready" && list.devices.length > 0 && (
        <ul className="device-list">
          {list.devices.map((d) => (
            <li key={d.id}>
              <Icon name="devices" size={20} />
              <span className="device-name">{d.label}</span>
              <button type="button" className="secondary-button" disabled={sending !== null} onClick={() => send(d)}>
                {sending === d.id ? t("Sending…") : t("Send here")}
                <span className="visually-hidden"> ({d.label})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setList({ status: "loading" });
            setAttempt((a) => a + 1);
          }}
        >
          {t("Refresh")}
        </button>
      </div>
    </div>
  );
}

/** Offers a book sent to this device from another one: Listen here, or Not now. */
export function HandoffPrompt() {
  const { link } = usePlayback();
  const { state } = useStore();
  const navigate = useNavigate();
  const t = useT();
  const { incoming } = link;
  // An upload is found among the active profile's own (they aren't in the catalog).
  const uploaded = useUploadedBook(incoming?.bookId);
  if (!incoming) return null;
  const book = getBook(incoming.bookId) ?? uploaded;
  const profile = state.profiles.find((p) => p.id === incoming.profileId);
  if (!book || !profile) return null;
  const otherProfile = profile.id !== state.activeProfileId;

  return (
    <section className="handoff" aria-label={t("Sent from another device")}>
      <p>
        {rich(t("{title} was sent here from {device}, at {time}.", { device: incoming.fromLabel, time: formatTime(incoming.position) }), {
          title: <strong>{book.title}</strong>,
        })}
        {otherProfile && <> {t("It's for {name}: switch to {name}'s profile to listen.", { name: profile.name })}</>}
      </p>
      <div className="handoff-actions">
        {!otherProfile && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              const opened = link.accept();
              if (opened) navigate(`/listen/${opened.id}`);
            }}
          >
            <Icon name="headphones" size={16} />
            {t("Listen here")}
          </button>
        )}
        <button type="button" className="secondary-button" onClick={link.dismiss}>
          {t("Not now")}
        </button>
      </div>
    </section>
  );
}

/**
 * Cast: plays the recording on a speaker or TV through the browser's own picker (Chromecast,
 * AirPlay). Shown only when the browser finds somewhere to cast and the book's recording is
 * playing (device voices speak on this device).
 */
export function CastButton({ className = "text-button", recording }: { className?: string; recording: boolean }) {
  const cast = useCast();
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  if (!recording || !cast.available) return null;
  return (
    <>
      <button
        type="button"
        className={className}
        aria-pressed={cast.connected}
        onClick={() => {
          setError(null);
          startCast().catch((err: Error) => {
            // Closing the picker without choosing isn't an error.
            if (err.name !== "NotAllowedError" && err.name !== "AbortError") setError(t("We couldn't reach that device. Try again."));
          });
        }}
      >
        <Icon name="devices" size={16} /> {cast.connected ? t("Casting") : cast.connecting ? t("Connecting…") : t("Cast to a speaker or TV")}
      </button>
      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={15} /> {error}
        </p>
      )}
    </>
  );
}
