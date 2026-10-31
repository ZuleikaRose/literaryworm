import type { Book } from "../types";
import { usePlayback } from "./playback";
import { bookStart, playerPlaces } from "./playerNav";
import { chapterTimes } from "./reading";
import { usePlayerSettings } from "./usePlayerSettings";
import { useUpNext } from "./useUpNext";
import { useStore } from "../store/context";
import { activeReading } from "../store/reducer";

/**
 * What the player page and the mini-player both offer for the open book: where each control
 * goes, and the actions. A control whose place doesn't apply right now is null (disable it).
 */
export function usePlayerControls(book: Book) {
  const playback = usePlayback();
  const settings = usePlayerSettings();
  const { player } = settings;
  const { starts, total } = chapterTimes(book);
  const live = playback.snapshot?.bookId === book.id ? playback.snapshot : null;
  const position = live?.position ?? 0;
  const places = playerPlaces(book, starts, total, position, player.autoSkipIntro);
  const { seek } = playback;
  const go = (target: number | null) => (target === null ? null : () => seek(target));
  const start = bookStart(book, player.autoSkipIntro);
  const upNext = useUpNext();
  const progress = activeReading(useStore().state).progress;
  const queued = upNext.next(book.id);
  // Plays the first book in Up next from the profile's place in it, and takes it off the queue.
  const playNext = queued
    ? () => {
        const p = progress[queued.id];
        const at = p && !p.finished ? p.fraction * chapterTimes(queued).total : bookStart(queued, player.autoSkipIntro);
        playback.open(queued, { at, autoplay: true });
        upNext.remove(queued.id).catch((err: Error) => console.error("up next: couldn't update:", err.message));
      }
    : null;

  return {
    live,
    starts,
    total,
    position,
    places,
    player,
    settings,
    skipBack: () => seek(position - player.skipBack),
    skipForward: () => seek(position + player.skipForward),
    previousChapter: go(places.previousChapter),
    nextChapter: go(places.nextChapter),
    beginning: position > start ? () => seek(start) : null,
    // At the end already, there's nowhere further to go (the end itself finishes the book).
    end: position < places.end ? () => seek(places.end) : null,
    skipIntro: go(places.introEnd),
    skipOutro: go(places.outroSkip),
    /** The first book in Up next (after this one), and Play it. */
    upNext: queued ? { book: queued, play: playNext! } : null,
  };
}

export type PlayerControls = ReturnType<typeof usePlayerControls>;
