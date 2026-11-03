import { useEffect } from "react";
import { Link } from "react-router-dom";
import { formatTimeLeft, listeningSecondsLeft } from "../lib/pace";
import { usePlayback } from "../lib/playback";
import type { PlayerControls } from "../lib/usePlayerControls";
import type { Book } from "../types";
import { useActiveProfile } from "../store/context";
import { voiceControlOffered } from "../lib/voiceCommands";
import { Icon } from "./Icon";
import { VoiceControl } from "./VoiceControl";
import { useT } from "../lib/useT";

/**
 * Car mode: the player at a glance, for a phone on a dashboard mount. Five big buttons (the same
 * controls as the player, from usePlayerControls), the title and the time left, high contrast,
 * and the screen kept awake where the browser allows it. Exit goes back to the full player.
 */
export function CarMode({ book, controls }: { book: Book; controls: PlayerControls }) {
  const playback = usePlayback();
  const t = useT();
  const { live, player, places, position, total } = controls;
  const playing = live?.playing ?? false;
  const chapter = book.chapters[places.chapterIndex];
  const voice = voiceControlOffered(useActiveProfile()?.ageRating);

  // Keep the screen on while car mode is open (released when it closes or the tab hides).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let live = true;
    const request = () => {
      if (!("wakeLock" in navigator) || document.hidden) return;
      navigator.wakeLock.request("screen").then(
        (l) => {
          if (live) lock = l;
          else void l.release();
        },
        () => undefined,
      );
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", request);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  return (
    <div className="car-mode">
      <header className="car-top">
        {voice && <VoiceControl book={book} controls={controls} />}
        <Link className="secondary-button" to={`/listen/${book.id}`} replace>
          <Icon name="close" size={18} /> {t("Exit")}<span className="car-exit-more"> {t("car mode")}</span>
        </Link>
      </header>
      <div className="car-now">
        <h1>{book.title}</h1>
        <p>{chapter?.title}</p>
        <p className="car-left">
          {live?.finished
            ? t("Finished")
            : t("{time} left in this chapter", { time: formatTimeLeft(listeningSecondsLeft(places.chapterEnd - position, player.speed)) })}
          <span className="visually-hidden">, {t("{time} in the book", { time: formatTimeLeft(listeningSecondsLeft(total - position, player.speed)) })}</span>
        </p>
      </div>
      <div className="car-controls">
        <button type="button" className="car-button car-prev" disabled={!controls.previousChapter} onClick={controls.previousChapter ?? undefined}>
          <Icon name="previousChapter" size={34} />
          <span>{t("Previous chapter")}</span>
        </button>
        <button type="button" className="car-button car-back" onClick={controls.skipBack}>
          <Icon name="skipBack" size={38} />
          <span>{t("Back {n}\u00a0s", { n: player.skipBack })}</span>
        </button>
        <button type="button" className="car-button car-play" onClick={playback.toggle}>
          <Icon name={playing ? "pause" : "play"} size={56} filled />
          <span>{playing ? t("Pause") : t("Play")}</span>
        </button>
        <button type="button" className="car-button car-forward" onClick={controls.skipForward}>
          <Icon name="skipForward" size={38} />
          <span>{t("Forward {n}\u00a0s", { n: player.skipForward })}</span>
        </button>
        <button type="button" className="car-button car-next-chapter" disabled={!controls.nextChapter} onClick={controls.nextChapter ?? undefined}>
          <Icon name="nextChapter" size={34} />
          <span>{t("Next chapter")}</span>
        </button>
      </div>
      {live?.finished && controls.upNext && (
        <button type="button" className="primary-button car-next" onClick={controls.upNext.play}>
          <Icon name="play" size={20} filled /> {t("Play next: {title}", { title: controls.upNext.book.title })}
        </button>
      )}
      <p className="car-note">{t("Keep your eyes on the road: set things up before you drive, or ask a passenger.")}</p>
    </div>
  );
}
