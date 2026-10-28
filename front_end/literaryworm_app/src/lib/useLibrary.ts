import { useStore } from "../store/context";
import { activeLibrary } from "../store/reducer";
import type { LibraryEntry, ReadingStatus } from "../types";
import { addLibraryItem, recordReading, removeLibraryItem, setLibraryStatus } from "./accountApi";
import { today } from "./reading";

type NewEntry = Pick<LibraryEntry, "bookId"> & Partial<Pick<LibraryEntry, "title" | "authors" | "cover">>;

/**
 * The active library and how to change it. Real accounts write to Supabase first
 * (library_items, owner-only RLS) and update the app once the database has agreed, so the
 * screen never shows a change that wasn't saved. In-memory accounts change the store directly.
 * Each change rejects with an AccountError the caller shows next to the control.
 */
export function useLibrary() {
  const { state, dispatch } = useStore();
  const remote = Boolean(state.account?.userId);

  /** Counts a newly finished book towards the active profile's goal (members: in Supabase too, in the background). */
  function countFinished() {
    const day = today();
    dispatch({ type: "finishedBook", day });
    if (remote && state.activeProfileId) {
      recordReading(state.activeProfileId, day, 0, 1).catch((err: unknown) => console.error("goals: couldn't count a finished book", err));
    }
  }

  async function add(entry: NewEntry, status: ReadingStatus = "want_to_read") {
    if (remote) {
      const saved = await addLibraryItem(entry.bookId, status);
      dispatch({ type: "addToLibrary", entry: { ...entry, addedAt: saved.addedAt }, status: saved.status });
    } else {
      dispatch({ type: "addToLibrary", entry, status });
    }
    if (status === "finished") countFinished();
  }

  async function setStatus(bookId: string, status: ReadingStatus) {
    const wasFinished = activeLibrary(state)[bookId]?.status === "finished";
    if (remote) await setLibraryStatus(bookId, status);
    dispatch({ type: "setReadingStatus", bookId, status });
    // Marking a book finished counts towards the profile's goal, like finishing it in the reader.
    if (status === "finished" && !wasFinished) countFinished();
  }

  async function remove(bookId: string) {
    if (remote) await removeLibraryItem(bookId);
    dispatch({ type: "removeFromLibrary", bookId });
  }

  return { entries: activeLibrary(state), remote, add, setStatus, remove };
}
