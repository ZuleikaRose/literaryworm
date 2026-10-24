import { createContext, useContext } from "react";
import type { Book, Format } from "../types";
import type { SleepTimer } from "./reading";

/**
 * The audiobook that's playing, shared by the player page and the mini-player. Playback lives
 * above the routes (components/PlaybackProvider.tsx), so a book keeps playing while the member
 * browses. One book plays at a time.
 */

/** What's happening in the book that's open, refreshed as the sample clock runs. */
export interface PlaybackSnapshot {
  bookId: string;
  /** Seconds from the start of the book. */
  position: number;
  total: number;
  playing: boolean;
  finished: boolean;
  sleep: SleepTimer;
  /** Seconds of playing left on a minutes sleep timer. */
  sleepLeft: number;
  /** A one-line message (sleep timer stopped, daily limit). */
  notice: string | null;
  limitReached: boolean;
  limitMinutes: number | null;
  saveError: string | null;
}

export interface BookmarkPlace {
  format: Format;
  fraction: number;
  chapterIndex: number;
  label: string;
}

/** What the engine for the open book can do. */
export interface PlaybackEngine {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setSleep: (value: string) => void;
  /** Finishes the book (after *Mark as finished?*). */
  finish: () => void;
  restart: () => void;
  allowMore: () => void;
  addBookmark: (place: BookmarkPlace) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
}

export interface Playback {
  /** The open book, or null when nothing is playing or paused. */
  book: Book | null;
  /** Null until the engine for `book` has started. */
  snapshot: PlaybackSnapshot | null;
  /** Opens a book (paused). Does nothing if it's already the open book. */
  open: (book: Book) => void;
  /** Pauses, saves the place and puts the book away (the mini-player goes). */
  close: () => void;
  /** Stable, so effects can depend on it. Does nothing with no book open. */
  pause: () => void;
  play: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  setSleep: (value: string) => void;
  finish: () => void;
  restart: () => void;
  allowMore: () => void;
  addBookmark: (place: BookmarkPlace) => Promise<void>;
  removeBookmark: (id: string) => Promise<void>;
}

export const PlaybackContext = createContext<Playback | null>(null);

export function usePlayback(): Playback {
  const playback = useContext(PlaybackContext);
  if (!playback) throw new Error("usePlayback must be used inside PlaybackProvider");
  return playback;
}
