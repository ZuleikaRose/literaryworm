import { createContext, useContext } from "react";
import type { Book, Format } from "../types";
import type { Handoff, ListeningDevice } from "./devicesApi";
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
  /** Set when the plan's audiobook hours for the month are used up (lib/useListeningAllowance.ts). */
  allowance: AllowanceUsed | null;
  /** On plans with a listening limit: seconds of it left this month for the household, and the plan's hours. */
  listeningLeft: { seconds: number; hours: number } | null;
  saveError: string | null;
}

/** The month's listening is used up: the plan, its hours, and when listening starts again. */
export interface AllowanceUsed {
  planName: string;
  hours: number;
  resumesOn: string;
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

/** Where to open a book, instead of the profile's saved place. */
export interface StartAt {
  /** Seconds from the start of the book. */
  at: number;
  /** Starts playing straight away (call it inside a click, or browsers may block the sound). */
  autoplay: boolean;
}

/** Listening on another device (members only; see lib/useDeviceLink.ts). */
export interface DeviceLink {
  /** False for in-memory accounts and copies of the app without the backend. */
  available: boolean;
  /** This device's name, as other devices see it. */
  thisDevice: string;
  /** The account's other open devices. Rejects with a message to show. */
  listDevices: () => Promise<ListeningDevice[]>;
  /** Sends the open book, at its place, to `device` for the active profile, then pauses it here. */
  sendTo: (device: ListeningDevice) => Promise<void>;
  /** A book sent to this device, waiting to be picked up. */
  incoming: Handoff | null;
  /** Opens the incoming book at its place and plays it; returns it (null if this profile can't). */
  accept: () => Book | null;
  dismiss: () => void;
}

export interface Playback {
  /** The open book, or null when nothing is playing or paused. */
  book: Book | null;
  /** Null until the engine for `book` has started. */
  snapshot: PlaybackSnapshot | null;
  /**
   * Opens a book (paused, at the profile's place). Does nothing if it's already the open book,
   * unless `start` says where to go.
   */
  open: (book: Book, start?: StartAt) => void;
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
  link: DeviceLink;
}

export const PlaybackContext = createContext<Playback | null>(null);

export function usePlayback(): Playback {
  const playback = useContext(PlaybackContext);
  if (!playback) throw new Error("usePlayback must be used inside PlaybackProvider");
  return playback;
}
