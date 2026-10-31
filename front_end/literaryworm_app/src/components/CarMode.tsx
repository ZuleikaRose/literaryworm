import { useEffect } from "react";
import { Link } from "react-router-dom";
import { formatTimeLeft, listeningSecondsLeft } from "../lib/pace";
import { usePlayback } from "../lib/playback";
import type { PlayerControls } from "../lib/usePlayerControls";
import type { Book } from "../types";
import { Icon } from "./Icon";

/**
 * Car mode: the player at a glance, for a phone on a dashboard mount. Five big buttons (the same
 * controls as the player, from usePlayerControls), the title and the time left, high contrast,
 * and the screen kept awake where the browser allows it. Exit goes back to the full player.
 */
export function CarMode({ book, controls }: { book: Book; controls: PlayerControls }) {
  const playback = usePlayback();
  const { live, player, places, position, total } = controls;
  const playing = live?.playing ?? false;
  const chapter = book.chapters[places.chapterIndex];

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
        <Link className="secondary-button" to={`/listen/${book.id}`} replace>
          <Icon name="close" size={18} /> Exit car mode
        </Link>
      </header>
      <div className="car-now">
        <h1>{book.title}</h1>
        <p>{chapter?.title}</p>
        <p className="car-left">
          {live?.finished ? "Finished" : `${formatTimeLeft(listeningSecondsLeft(places.chapterEnd - position, player.speed))} left in this chapter`}
          <span className="visually-hidden">, {formatTimeLeft(listeningSecondsLeft(total - position, player.speed))} in the book</span>
        </p>
      </div>
      <div className="car-controls">
        <button type="button" className="car-button" disabled={!controls.previousChapter} onClick={controls.previousChapter ?? undefined}>
          <Icon name="previousChapter" size={34} />
          <span>Previous chapter</span>
        </button>
        <button type="button" className="car-button" onClick={controls.skipBack}>
          <Icon name="skipBack" size={38} />
          <span>Back {player.skipBack} s</span>
        </button>
        <button type="button" className="car-button car-play" onClick={playback.toggle}>
          <Icon name={playing ? "pause" : "play"} size={56} filled />
          <span>{playing ? "Pause" : "Play"}</span>
        </button>
        <button type="button" className="car-button" onClick={controls.skipForward}>
          <Icon name="skipForward" size={38} />
          <span>Forward {player.skipForward} s</span>
        </button>
        <button type="button" className="car-button" disabled={!controls.nextChapter} onClick={controls.nextChapter ?? undefined}>
          <Icon name="nextChapter" size={34} />
          <span>Next chapter</span>
        </button>
      </div>
      {live?.finished && controls.upNext && (
        <button type="button" className="primary-button car-next" onClick={controls.upNext.play}>
          <Icon name="play" size={20} filled /> Play next: {controls.upNext.book.title}
        </button>
      )}
      <p className="car-note">Keep your eyes on the road: set things up before you drive, or ask a passenger.</p>
    </div>
  );
}
