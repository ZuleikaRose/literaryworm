import { useStore } from "../store/context";
import { activeLibrary } from "../store/reducer";
import type { LibraryEntry, ReadingStatus } from "../types";
import { addLibraryItem, removeLibraryItem, setLibraryStatus } from "./accountApi";

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

  async function add(entry: NewEntry, status: ReadingStatus = "want_to_read") {
    if (remote) {
      const saved = await addLibraryItem(entry.bookId, status);
      dispatch({ type: "addToLibrary", entry: { ...entry, addedAt: saved.addedAt }, status: saved.status });
    } else {
      dispatch({ type: "addToLibrary", entry, status });
    }
  }

  async function setStatus(bookId: string, status: ReadingStatus) {
    if (remote) await setLibraryStatus(bookId, status);
    dispatch({ type: "setReadingStatus", bookId, status });
  }

  async function remove(bookId: string) {
    if (remote) await removeLibraryItem(bookId);
    dispatch({ type: "removeFromLibrary", bookId });
  }

  return { entries: activeLibrary(state), remote, add, setStatus, remove };
}
