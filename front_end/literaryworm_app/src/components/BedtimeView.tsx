import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { bedtimeTimer } from "../lib/bedtimeListening";
import { usePlayback } from "../lib/playback";
import { useBedtimeTime } from "../lib/useBedtimeTime";
import { formatTime, SLEEP_MINUTES } from "../lib/reading";
import type { PlayerControls } from "../lib/usePlayerControls";
import { useT } from "../lib/useT";
import type { Book } from "../types";
import { Icon } from "./Icon";
import { SleepMore } from "./PlayerControls";

/**
 * Bedtime listening: a dim, quiet view of the player for winding down (lib/bedtimeListening.ts).
 * Opening it starts a sleep timer when none is set (the end of the chapter when that's near, else
 * 15 minutes), which fades the sound out and saves the place. Nothing keeps the screen awake, and
 * *Dimmer* darkens it further. Exit goes back to the full player.
 */
export function BedtimeView({ book, controls }: { book: Book; controls: PlayerControls }) {
  const playback = usePlayback();
  const t = useT();
  const [dim, setDim] = useState(false);
  const { live, places, position, player } = controls;
  const playing = live?.playing ?? false;
  const sleep = live?.sleep ?? null;
  const chapter = book.chapters[places.chapterIndex];
  // Kids profiles' time here goes in the Kids reading report.
  useBedtimeTime(playing);

  // Start the timer once, when the view opens, if the listener hasn't set one.
  const latest = useRef({ sleep, setSleep: playback.setSleep, timer: bedtimeTimer(places.chapterEnd - position, player.speed) });
  useEffect(() => {
    latest.current = { sleep, setSleep: playback.setSleep, timer: bedtimeTimer(places.chapterEnd - position, player.speed) };
  });
  useEffect(() => {
    const now = latest.current;
    if (now.sleep === null) now.setSleep(now.timer);
  }, [book.id]);

  const sleepValue = sleep === null ? "off" : sleep.kind === "chapter" ? "chapter" : String(sleep.minutes);
  const status =
    live?.sleptAt !== null && live?.sleptAt !== undefined && !playing
      ? t("Goodnight. Your place is saved.")
      : sleep?.kind === "minutes"
        ? t("Stops in {time}", { time: formatTime(live?.sleepLeft ?? 0) })
        : sleep?.kind === "chapter"
          ? t("Stops at the end of this chapter")
          : t("No sleep timer: it plays on until you pause.");

  return (
    <div className={`bedtime-view${dim ? " is-dim" : ""}`}>
      <header className="bedtime-top">
        <button type="button" className="text-button" aria-pressed={dim} onClick={() => setDim((d) => !d)}>
          <Icon name="moon" size={18} /> {t("Dimmer")}
        </button>
        <Link className="secondary-button" to={`/listen/${book.id}`} replace>
          <Icon name="close" size={18} /> {t("Exit")}
          <span className="visually-hidden"> {t("bedtime listening")}</span>
        </Link>
      </header>
      <div className="bedtime-now">
        <p className="eyebrow">{t("Bedtime listening")}</p>
        <h1>{book.title}</h1>
        {chapter && <p>{chapter.title}</p>}
        <p className="bedtime-status" role="timer">
          {status}
        </p>
      </div>
      <div className="bedtime-controls">
        <button type="button" className="bedtime-button" onClick={controls.skipBack}>
          <Icon name="skipBack" size={30} />
          <span>{t("Back {n} s", { n: player.skipBack })}</span>
        </button>
        <button type="button" className="bedtime-button bedtime-play" onClick={playback.toggle}>
          <Icon name={playing ? "pause" : "play"} size={48} filled />
          <span>{playing ? t("Pause") : t("Play")}</span>
        </button>
      </div>
      <SleepMore className="bedtime-more" />
      <label className="player-select bedtime-timer">
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
      <p className="bedtime-note">{t("The sound fades out when the timer ends, and your place is saved. Let the screen go dark.")}</p>
    </div>
  );
}
