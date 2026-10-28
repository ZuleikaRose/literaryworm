import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store/context";
import { activeLibrary, activeReading } from "../store/reducer";
import { newId } from "../store/state";
import type { Book, Bookmark, Format, Progress, ReadingStatus } from "../types";
import * as accountApi from "./accountApi";
import { AccountError } from "./accountApi";
import { today } from "./reading";

type Place = Pick<Progress, "format" | "fraction" | "chapterIndex"> & { finished?: boolean };

/** How long the reader waits after the last page turn before saving to Supabase. */
const SAVE_DELAY_MS = 1500;

/**
 * Progress and bookmarks for one book in the reader or player (highlights are in useHighlights).
 *
 * Opening a book puts it in the library as "Reading" (a "Want to read" book moves to
 * "Reading"), because progress and bookmarks belong to a library book, as in the database.
 * The place is kept on screen straight away and saved to Supabase a moment later (real
 * accounts), so reading never waits for the network; if a save fails, `saveError` says so and
 * the next page turn tries again. Bookmarks are saved first, then shown, like the library.
 * `profileId` pins in-memory progress to one profile (the mini-player keeps playing while
 * someone switches profile).
 */
export function useReading(book: Book, profileId?: string) {
  const { state, dispatch } = useStore();
  const readerProfileId = profileId ?? state.activeProfileId;
  const remote = Boolean(state.account?.userId);
  const reading = activeReading(state);
  const progress: Progress | undefined = reading.progress[book.id];
  const bookmarks = reading.bookmarks.filter((b) => b.bookId === book.id).sort((a, b) => a.fraction - b.fraction);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The latest state for callbacks that outlive a render (timers, unmount).
  const latest = useRef({ state, remote });
  useEffect(() => {
    latest.current = { state, remote };
  });
  const pending = useRef<Progress | null>(null);
  const timer = useRef<number | undefined>(undefined);

  // The book's library status as far as this page knows, and a queue so changes run one at a
  // time (opening the page twice in development, or a save racing the first add, can't add twice).
  const knownStatus = useRef<ReadingStatus | null | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());

  /** Counts a newly finished book towards the profile's goal (members: in Supabase too, in the background). */
  const countFinished = useCallback(() => {
    const day = today();
    dispatch({ type: "finishedBook", day, profileId: readerProfileId ?? undefined });
    if (latest.current.remote && readerProfileId) {
      accountApi.recordReading(readerProfileId, day, 0, 1).catch((err: unknown) => console.error("goals: couldn't count a finished book", err));
    }
  }, [dispatch, readerProfileId]);

  /** Adds the book to the library as Reading, or moves it on from Want to read / to Finished. */
  const ensureInLibrary = useCallback(
    (finished: boolean) => {
      const run = async () => {
        const { state: current, remote: isRemote } = latest.current;
        if (knownStatus.current === undefined) knownStatus.current = activeLibrary(current)[book.id]?.status ?? null;
        const status: ReadingStatus = finished ? "finished" : "reading";
        const known = knownStatus.current;
        if (known === null) {
          const entry = { bookId: book.id, title: book.title, authors: [book.author], cover: null };
          if (isRemote) {
            const saved = await accountApi.addLibraryItem(book.id, status);
            dispatch({ type: "addToLibrary", entry: { ...entry, addedAt: saved.addedAt }, status: saved.status });
          } else {
            dispatch({ type: "addToLibrary", entry, status });
          }
          knownStatus.current = status;
          if (finished) countFinished();
        } else if (known !== status && (finished || known === "want_to_read")) {
          if (isRemote) await accountApi.setLibraryStatus(book.id, status);
          dispatch({ type: "setReadingStatus", bookId: book.id, status });
          knownStatus.current = status;
          if (finished) countFinished();
        }
      };
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => undefined);
      return next;
    },
    [book, dispatch, countFinished],
  );

  /** Sends the latest place to Supabase. */
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const place = pending.current;
    pending.current = null;
    if (!place || !latest.current.remote) return;
    try {
      await ensureInLibrary(place.finished);
      await accountApi.saveProgress(place);
      setSaveError(null);
    } catch (err) {
      // Keep it for the next try unless a newer place has arrived meanwhile.
      pending.current ??= place;
      setSaveError(err instanceof AccountError ? err.message : "We couldn't save your place. We'll try again as you read.");
    }
  }, [ensureInLibrary]);

  // Opening the book adds it to the library; in-memory accounts do this instantly.
  useEffect(() => {
    ensureInLibrary(false).catch((err) =>
      setSaveError(
        err instanceof AccountError
          ? `${err.message} Your place won't be saved until it's in your library.`
          : "We couldn't add this book to your library, so your place isn't saved yet.",
      ),
    );
  }, [ensureInLibrary]);

  // Leaving the tab saves the place straight away, so another device opened next finds it.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  // Leaving the reader saves the last place straight away.
  useEffect(
    () => () => {
      void flush();
    },
    [flush],
  );

  const save = useCallback(
    (place: Place) => {
      const next: Progress = {
        bookId: book.id,
        format: place.format,
        fraction: place.fraction,
        chapterIndex: place.chapterIndex,
        finished: place.finished ?? false,
        updatedAt: Date.now(),
      };
      dispatch({ type: "saveProgress", progress: next, profileId });
      if (!latest.current.remote) {
        if (next.finished) void ensureInLibrary(true);
        return;
      }
      pending.current = next;
      window.clearTimeout(timer.current);
      if (next.finished) void flush();
      else timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [book.id, dispatch, ensureInLibrary, flush, profileId],
  );

  async function addBookmark(place: { format: Format; fraction: number; chapterIndex: number; label: string }) {
    const draft = { bookId: book.id, ...place };
    if (remote) {
      await ensureInLibrary(false);
      const saved = await accountApi.addBookmark(draft);
      dispatch({ type: "addBookmark", bookmark: saved });
    } else {
      const bookmark: Bookmark = { ...draft, id: newId(), createdAt: Date.now() };
      dispatch({ type: "addBookmark", bookmark });
    }
  }

  async function removeBookmark(id: string) {
    if (remote) await accountApi.removeBookmark(id);
    dispatch({ type: "removeBookmark", id });
  }

  /** For other things that belong to a library book (highlights). */
  const addToLibrary = useCallback(() => ensureInLibrary(false), [ensureInLibrary]);

  return { progress, bookmarks, save, flush, saveError, addBookmark, removeBookmark, addToLibrary };
}
