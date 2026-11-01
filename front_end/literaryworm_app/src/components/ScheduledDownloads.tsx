import { useEffect, useState } from "react";
import { offlineSupported, readNote, readOfflinePlace, removeTracks, savedTracks, saveTracks } from "../lib/offline";
import { type ConnectionInfo, connectionAllows, parseSchedule, SCHEDULE_CHANGED, schedulePath, schedulePlan } from "../lib/offlineSchedule";
import { usePlayback } from "../lib/playback";
import { chapterAt, chapterTimes } from "../lib/reading";
import { useStore } from "../store/context";

const connection = () => (navigator as Navigator & { connection?: ConnectionInfo }).connection;

// One run at a time: a new run waits for the last to stop (it checks between tracks), so two runs
// never fetch the same track or put back one the newer run removed.
let running: Promise<void> = Promise.resolve();

/**
 * Scheduled downloads (lib/offlineSchedule.ts), above the routes like MediaSession: while a book
 * with a schedule on this device is open in the player, keeps the chapter playing and the next
 * ones saved, and removes played ones if asked, whenever the chapter changes or the device comes
 * back online. Quiet: failures are logged and tried again next time. Members' devices need their
 * offline place (taken when the schedule was set); without it nothing is downloaded.
 */
export function ScheduledDownloads() {
  const { book, snapshot } = usePlayback();
  const userId = useStore().state.account?.userId ?? null;
  // The chapter playing (a recording's tracks are its chapters), worked out from the position.
  const chapter = book && snapshot && snapshot.bookId === book.id ? chapterAt(chapterTimes(book).starts, snapshot.position) : null;
  const [online, setOnline] = useState(0);

  useEffect(() => {
    const again = () => setOnline((n) => n + 1);
    // Back online, or a schedule saved in Read offline: run again with what's saved now.
    window.addEventListener("online", again);
    window.addEventListener(SCHEDULE_CHANGED, again);
    return () => {
      window.removeEventListener("online", again);
      window.removeEventListener(SCHEDULE_CHANGED, again);
    };
  }, []);

  useEffect(() => {
    if (!book?.recording || chapter === null || !offlineSupported() || !navigator.onLine) return;
    let live = true;
    const run = running.then(async () => {
      if (!live) return;
      const schedule = parseSchedule(await readNote(schedulePath(book.id)));
      if (!schedule || !live || !connectionAllows(connection(), schedule)) return;
      // A member's device must hold one of the account's offline places (taken when the schedule was set).
      if (userId && (await readOfflinePlace())?.userId !== userId) return;
      const plan = schedulePlan(schedule, chapter, book.recording!.tracks.length, await savedTracks(book));
      if (!live) return;
      await removeTracks(book, plan.remove);
      await saveTracks(book, plan.download, () => !live);
    });
    running = run.catch((err: unknown) => console.warn("offline: a scheduled download didn't finish", (err as Error).message));
    return () => {
      live = false;
    };
  }, [book, chapter, userId, online]);

  return null;
}
