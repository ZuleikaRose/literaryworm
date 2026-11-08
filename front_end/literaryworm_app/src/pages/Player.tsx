import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BedtimeView } from "../components/BedtimeView";
import { CarMode } from "../components/CarMode";
import { nearBedtime } from "../lib/bedtimeListening";
import { RecapDialog } from "../components/RecapDialog";
import { ClipDialog } from "../components/ClipDialog";
import { VoiceSelect } from "../components/VoiceSettings";
import { Cover } from "../components/Cover";
import { Icon } from "../components/Icon";
import { UploadRecordingLink } from "../components/UploadRecordingLink";
import { ContinueDialog } from "../components/ContinueOnPhone";
import { playerContinueUrl, readAt } from "../lib/continueLink";
import { CastButton, DevicesDialog, JumpDialog, type JumpSection, PlayerSettingsDialog, SleepMore, VolumeControl } from "../components/PlayerControls";
import { BookmarksDialog, DailyLimitReached, ListeningAllowanceUsed, FinishedPanel, MarkFinishedDialog, ReadingGate } from "../components/ReadingParts";
import { Transcript } from "../components/Transcript";
import { resolveNarration, useVoices, voiceLabel } from "../lib/narration";
import { NATURAL_VOICE_HOURS } from "../lib/naturalVoice";
import { useNaturalVoice } from "../lib/useNaturalVoice";
import { usePlayback } from "../lib/playback";
import { hoursAndMinutes } from "../lib/planLimits";
import { CREDITS_SECONDS, chapterLabel, chapterTimes, formatTime, PLAYBACK_SPEEDS, SLEEP_MINUTES, spokenTime } from "../lib/reading";
import { usePlayerControls } from "../lib/usePlayerControls";
import { canRecap } from "../lib/recap";
import { formatTimeLeft, listeningSecondsLeft } from "../lib/pace";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { rich } from "../lib/i18n";
import { useAlignment } from "../lib/useAlignment";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { Book } from "../types";
import { VoiceWholeBook } from "../components/VoiceWholeBook";

type Panel = "jump" | "bookmarks" | "settings" | "devices" | "recap" | "clip" | "continue" | null;

export default function Player() {
  return <ReadingGate format="audiobook">{(book) => <PlayerView key={book.id} book={book} />}</ReadingGate>;
}

function PlayerView({ book }: { book: Book }) {
  const t = useT();
  useTitle(t("Listening to {title}", { title: book.title }));
  const { state, dispatch } = useStore();
  const { narrationVoice } = useProfileData();
  const voices = useVoices();
  const naturalSource = useNaturalVoice(book);
  const naturalOffered = naturalSource !== null;
  const profile = useActiveProfile();
  const narration = resolveNarration(book, narrationVoice, voices, naturalOffered);
  // The pilot's books have their recording lined up with the text, for a true read-along.
  const alignment = useAlignment(book, narration.kind === "recording" && state.a11y.transcript);
  const naturalHours = NATURAL_VOICE_HOURS[state.account?.planId ?? "basic"] ?? 0;
  const playback = usePlayback();
  const { open } = playback;
  const controls = usePlayerControls(book);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const carMode = params.get("view") === "car";
  const bedtimeView = params.get("view") === "bedtime";
  // A Kids profile's bedtime coming up (the device's clock, read once): the player suggests bedtime listening.
  const [openedAt] = useState(() => new Date());
  const windDown = profile?.ageRating === "kids" && nearBedtime(openedAt, profile.bedtime);
  const { starts, total, places, player, settings } = controls;
  const bookmarks = activeReading(state)
    .bookmarks.filter((b) => b.bookId === book.id)
    .sort((a, b) => a.fraction - b.fraction);
  const [panel, setPanel] = useState<Panel>(null);
  const [section, setSection] = useState<JumpSection>("contents");
  const [asking, setAsking] = useState(false);
  const jump = (to: JumpSection) => {
    setSection(to);
    setPanel("jump");
  };

  // The book plays through the app-wide engine, so it keeps playing in the mini-player after
  // this page closes.
  // A "Continue on your phone" link (?at=, lib/continueLink.ts) opens it at that place.
  const atParam = params.get("at");
  useLayoutEffect(() => {
    const at = readAt(atParam, chapterTimes(book).total);
    open(book, at === null ? undefined : { at, autoplay: false });
  }, [open, book, atParam]);

  const live = playback.snapshot?.bookId === book.id ? playback.snapshot : null;
  const position = live?.position ?? 0;
  const playing = live?.playing ?? false;
  const finished = live?.finished ?? false;
  const sleep = live?.sleep ?? null;

  const { chapterIndex, chapterStart } = places;
  const chapter = book.chapters[chapterIndex];
  const hereLabel = `Chapter ${chapterIndex + 1}, ${formatTime(position - chapterStart)}`;
  const seek = playback.seek;

  // Space plays and pauses, arrows skip, M mutes, unless a control that uses those keys has focus.
  const keys = useRef({ toggle: playback.toggle, skipBack: controls.skipBack, skipForward: controls.skipForward, mute: settings.toggleMute });
  useEffect(() => {
    keys.current = { toggle: playback.toggle, skipBack: controls.skipBack, skipForward: controls.skipForward, mute: settings.toggleMute };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, select, textarea, button, a, dialog, [role=button]") || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = keys.current;
      if (e.key === " " || e.key === "k") k.toggle();
      else if (e.key === "ArrowLeft" || e.key === "j") k.skipBack();
      else if (e.key === "ArrowRight" || e.key === "l") k.skipForward();
      else if (e.key === "m") k.mute();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!live) return <div className="player" aria-busy="true" />;

  if (live.allowance) {
    return <ListeningAllowanceUsed {...live.allowance} bookId={book.id} />;
  }

  if (carMode && !live.limitReached) return <CarMode book={book} controls={controls} />;
  if (live.bedtime) return <DailyLimitReached limitMinutes={live.limitMinutes} wake={live.bedtime} onAllowMore={playback.allowMore} />;
  if (live.limitReached && live.limitMinutes !== null) {
    return <DailyLimitReached limitMinutes={live.limitMinutes} onAllowMore={playback.allowMore} />;
  }
  if (bedtimeView) return <BedtimeView book={book} controls={controls} />;

  const isHereMarked = bookmarks.some((b) => b.format === "audiobook" && Math.abs(b.fraction * total - position) < 5);
  const sleepValue = sleep === null ? "off" : sleep.kind === "chapter" ? "chapter" : String(sleep.minutes);

  return (
    <div className="player">
      <header className="player-bar">
        <Link className="icon-button" to={`/books/${book.id}`}>
          <Icon name="arrowLeft" size={20} />
          <span className="visually-hidden">{t("Close the player")}</span>
        </Link>
        <p className="player-eyebrow">{t("Now listening")}</p>
        <div className="reader-tools">
          <button type="button" className="icon-button" onClick={() => jump("contents")}>
            <Icon name="list" size={20} />
            <span className="visually-hidden">{t("Table of contents")}</span>
          </button>
          <button type="button" className="icon-button" onClick={() => jump("index")}>
            <Icon name="search" size={20} />
            <span className="visually-hidden">{t("Go to: index, references or a time")}</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("bookmarks")}>
            <Icon name="bookmark" size={20} filled={isHereMarked} />
            <span className="visually-hidden">{t("Bookmarks")}</span>
          </button>
          {canRecap(book, chapterIndex) && (
            <button type="button" className="icon-button" onClick={() => setPanel("recap")}>
              <Icon name="bookOpen" size={20} />
              <span className="visually-hidden">{t("Previously…: catch up on the story so far")}</span>
            </button>
          )}
          <button type="button" className="icon-button" onClick={() => setPanel("devices")}>
            <Icon name="devices" size={20} />
            <span className="visually-hidden">{t("Listen on another device")}</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("continue")}>
            <Icon name="qr" size={20} />
            <span className="visually-hidden">{t("Continue on your phone")}</span>
          </button>
          <button type="button" className="icon-button" onClick={() => setPanel("settings")}>
            <Icon name="settings" size={20} />
            <span className="visually-hidden">{t("Skip lengths, intros and outros")}</span>
          </button>
          {!book.recording && (
            <button
              type="button"
              className="icon-button"
              aria-pressed={state.a11y.transcript}
              onClick={() => dispatch({ type: "updateA11y", patch: { transcript: !state.a11y.transcript } })}
            >
              <Icon name="subtitles" size={20} />
              <span className="visually-hidden">{t("Read-along transcript")}</span>
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
              {book.narrator && <> · {t("Narrated by {name}", { name: book.narrator })}</>}
            </p>
            <p className="player-chapter">{chapterLabel(book, chapterIndex)}</p>
          </div>

          {windDown && (
            <p className="form-success bedtime-nudge">
              <Icon name="moon" size={16} /> {t("Nearly bedtime.")}{" "}
              <Link to={`/listen/${book.id}?view=bedtime`}>{t("Try bedtime listening")}</Link>
            </p>
          )}

          {live.saveError && (
            <p className="reader-save-error" role="alert">
              <Icon name="alert" size={15} /> {live.saveError}
            </p>
          )}

          {finished ? (
            <FinishedPanel
              book={book}
              onRestart={playback.restart}
              upNext={
                controls.upNext && {
                  book: controls.upNext.book,
                  play: () => {
                    const next = controls.upNext!.book.id;
                    controls.upNext!.play();
                    navigate(`/listen/${next}`);
                  },
                }
              }
            />
          ) : (
            <>
              <div className="progress-track player-progress">
                <span className="chapter-marks" aria-hidden="true">
                  {starts.slice(1).map((start, i) => (
                    <span key={i} style={{ insetInlineStart: `${(start / total) * 100}%` }} />
                  ))}
                </span>
                <input
                  type="range"
                  className="progress-range"
                  min={0}
                  max={Math.round(total)}
                  step={1}
                  value={Math.round(position)}
                  aria-label={t("Position in the book")}
                  aria-valuetext={t("{position} of {total}, {chapter}", { position: spokenTime(position), total: spokenTime(total), chapter: chapter.title })}
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
                  <span className="visually-hidden">{t("Time left:")} </span>
                  {formatTime(total - position)}
                </span>
              </p>

              {!live.finished && (
                <p className="player-pace">
                  {player.speed === 1 ? "" : `${t("At {speed}×:", { speed: player.speed })} `}
                  {t("{chapter} left in this chapter · {book} in the book", {
                    chapter: formatTimeLeft(listeningSecondsLeft(places.chapterEnd - position, player.speed)),
                    book: formatTimeLeft(listeningSecondsLeft(total - position, player.speed)),
                  })}
                </p>
              )}
              {live.listeningLeft && (
                <p className={`player-allowance${live.listeningLeft.seconds <= live.listeningLeft.hours * 3600 * 0.2 ? " player-allowance-low" : ""}`}>
                  <Icon name="headphones" size={14} />{" "}
                  {t("{left} of this month's {hours} hours left for the household", {
                    left: hoursAndMinutes(live.listeningLeft.seconds),
                    hours: live.listeningLeft.hours,
                  })}
                </p>
              )}

              <div className="player-controls">
                <button type="button" className="icon-button" disabled={!controls.previousChapter} onClick={controls.previousChapter ?? undefined}>
                  <Icon name="previousChapter" size={20} />
                  <span className="visually-hidden">{t("Previous chapter")}</span>
                </button>
                <button type="button" className="skip-button" onClick={controls.skipBack}>
                  <Icon name="chevronLeft" size={18} />
                  <span aria-hidden="true">{player.skipBack}</span>
                  <span className="visually-hidden">{t("Back {n} seconds", { n: player.skipBack })}</span>
                </button>
                <button type="button" className="play-button" onClick={playback.toggle}>
                  <Icon name={playing ? "pause" : "play"} size={30} filled />
                  <span className="visually-hidden">{playing ? t("Pause") : t("Play")}</span>
                </button>
                <button type="button" className="skip-button" onClick={controls.skipForward}>
                  <span aria-hidden="true">{player.skipForward}</span>
                  <Icon name="chevronRight" size={18} />
                  <span className="visually-hidden">{t("Forward {n} seconds", { n: player.skipForward })}</span>
                </button>
                <button type="button" className="icon-button" disabled={!controls.nextChapter} onClick={controls.nextChapter ?? undefined}>
                  <Icon name="nextChapter" size={20} />
                  <span className="visually-hidden">{t("Next chapter")}</span>
                </button>
              </div>

              <div className="player-jumps">
                <button type="button" className="text-button" disabled={!controls.beginning} onClick={controls.beginning ?? undefined}>
                  <Icon name="startOfBook" size={16} /> {t("Beginning")}
                </button>
                <button type="button" className="text-button" disabled={!controls.skipIntro} onClick={controls.skipIntro ?? undefined}>
                  {t("Skip intro")}
                </button>
                <button type="button" className="text-button" disabled={!controls.skipOutro} onClick={controls.skipOutro ?? undefined}>
                  {t("Skip outro")}
                </button>
                <button type="button" className="text-button" disabled={!controls.end} onClick={controls.end ?? undefined}>
                  {t("End")} <Icon name="endOfBook" size={16} />
                </button>
              </div>

              <VolumeControl className="player-volume" />

              <div className="player-extras">
                <Link className="text-button" to={`/listen/${book.id}?view=car`}>
                  <Icon name="headphones" size={16} /> {t("Car mode")}
                </Link>
                <Link className="text-button" to={`/listen/${book.id}?view=bedtime`}>
                  <Icon name="moon" size={16} /> {t("Bedtime listening")}
                </Link>
                <CastButton recording={narration.kind === "recording"} />
                {(book.recording || (book.upload && naturalOffered)) && (
                  <button type="button" className="text-button" onClick={() => setPanel("clip")}>
                    <Icon name="share" size={16} /> {t("Share a clip")}
                  </button>
                )}
              </div>

              <div className="player-settings">
                <label className="player-select">
                  <span>{t("Speed")}</span>
                  <select value={player.speed} onChange={(e) => settings.update({ speed: Number(e.target.value) })}>
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
{/* Natural voices first, with a preview (components/VoiceSettings.tsx, also in the reader and on club pages). */}
                <VoiceSelect book={book} />
              </div>

              <p className="player-status" role="status">
                {live.notice ??
                  (sleep?.kind === "minutes"
                    ? t("Sleep timer: pauses after {time} more of playing", { time: formatTime(live.sleepLeft) })
                    : sleep?.kind === "chapter"
                      ? t("Sleep timer: pauses at the end of this chapter")
                      : "")}
              </p>
              <SleepMore />
            </>
          )}

          <p className="reader-sample-note">
            {narration.kind === "recording" && book.recording ? (
              <>
                {rich(t("Narrated by {narrator} for {link}: a public-domain recording, streamed from the Internet Archive.", { narrator: book.recording.narrator }), {
                  link: (
                    <a href={book.recording.page} target="_blank" rel="noreferrer">
                      LibriVox<span className="visually-hidden"> {t("(opens in a new tab)")}</span>
                    </a>
                  ),
                })}
              </>
            ) : narration.kind === "natural" ? (
              <>
                {naturalSource === "demo"
                  ? t("Read aloud by {voice}, a natural voice from Google. In the demo, this sample upload was voiced ahead of time; members' uploads are voiced as they listen, a part at a time, and kept so listening again is free.", { voice: narration.voice.name })
                  : book.upload
                    ? t("Read aloud by {voice}, a natural voice from Google, from your upload. Each part is voiced the first time you play it and kept with your upload, so listening again is free.", { voice: narration.voice.name })
                    : t("Read aloud by {voice}, a natural voice from Google, from the full public-domain text (Project Gutenberg). Each part is voiced the first time any member plays it and kept, so listening again is free. The LibriVox recording is still in Voice.", { voice: narration.voice.name })}{" "}
                {naturalSource !== "demo" &&
                  t.plural(naturalHours, {
                      one: "Your plan includes {count} hour of new natural-voice reading a month.",
                      other: "Your plan includes {count} hours of new natural-voice reading a month.",
                    })}
              </>
            ) : narration.kind === "speech" ? (
              book.recording ? (
                <>
                  {t("Read aloud by your device's {voice} voice from the full public-domain text (Project Gutenberg).", { voice: voiceLabel(narration.voice) })}
                  {naturalOffered && ` ${t("Or choose a natural voice from Google in Voice.")}`}
                </>
              ) : book.upload ? (
                <>
                  {t("Read aloud by your device's {voice} voice from your upload.", { voice: voiceLabel(narration.voice) })}
                  {naturalOffered && ` ${t("Or choose a natural voice from Google in Voice.")}`}
                </>
              ) : (
                <>{t("Read aloud by your device's {voice} voice from sample text: this title's narration isn't licensed yet.", { voice: voiceLabel(narration.voice) })}</>
              )
            ) : book.upload ? (
              <>{t("No voice is reading, so the clock runs silently. Choose a voice to hear your upload read aloud.")}</>
            ) : (
              <>{t("Sample player: this title's narration isn't licensed yet, so the clock runs silently.")}</>
            )}{" "}
            {voices.length < 10 &&
              (voices.length === 0
                ? t("This browser has no English voices to read aloud with.")
                : t.plural(voices.length, {
                    one: "This device has {count} English voice; Edge, Safari and phones usually offer more.",
                    other: "This device has {count} English voices; Edge, Safari and phones usually offer more.",
                  }))}{" "}
            {t("Space plays and pauses; the left and right arrows skip back {back} and forward {forward} seconds; M mutes. Leave the player and the book keeps playing in the mini-player, which has the same controls.", {
              back: player.skipBack,
              forward: player.skipForward,
            })}
          </p>
          {book.upload && !naturalOffered && !state.account?.userId && profile?.ageRating !== "kids" && (
            <p className="reader-sample-note">{t("Members can choose a natural voice from Google for their uploads.")}</p>
          )}
          {/* The demo never calls Google, so its classics keep their LibriVox recording. */}
          {book.publicDomain && book.recording && !book.upload && !naturalOffered && profile?.ageRating !== "kids" && (
            <p className="reader-sample-note">{t("Members can also hear the classics in natural voices from Google, with a voice of their own for each character.")}</p>
          )}
          {/* A Kids profile hears natural voices once a grown-up turns them on for it. */}
          {(book.upload || (book.publicDomain && book.recording)) && !naturalOffered && Boolean(state.account?.userId) && !state.account?.isDemo && profile?.ageRating === "kids" && (
            <p className="reader-sample-note">{t("Natural voices from Google need a grown-up's yes: they can turn them on for this profile in Account → Family.")}</p>
          )}
          {book.upload && <UploadRecordingLink upload={book} className="reader-sample-note" />}
          {book.upload && narration.kind === "natural" && <VoiceWholeBook book={book} />}
        </div>

        {/* A real recording shows the transcript only where it has been lined up with the text (the pilot,
            lib/alignment.ts); a device voice reading the real text always does. */}
        {state.a11y.transcript && !finished && (!book.recording || narration.kind === "speech" || alignment) && (
          <Transcript
            book={book}
            chapterIndex={chapterIndex}
            position={position}
            onSeek={seek}
            realText={Boolean(book.recording || book.upload)}
            alignment={narration.kind === "speech" ? null : alignment}
          />
        )}
      </main>

      <JumpDialog open={panel === "jump"} onClose={() => setPanel(null)} book={book} controls={controls} section={section} onSection={setSection} />
      <PlayerSettingsDialog open={panel === "settings"} onClose={() => setPanel(null)} />
      <DevicesDialog open={panel === "devices"} onClose={() => setPanel(null)} />
      {panel === "continue" && <ContinueDialog open onClose={() => setPanel(null)} url={playerContinueUrl(book.id, position)} title={book.title} />}
      <RecapDialog open={panel === "recap"} book={book} chapterIndex={chapterIndex} onClose={() => setPanel(null)} />
      {panel === "clip" && <ClipDialog open book={book} chapterIndex={chapterIndex} offset={position - chapterStart} chapterSeconds={places.chapterEnd - chapterStart} onClose={() => setPanel(null)} />}
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
