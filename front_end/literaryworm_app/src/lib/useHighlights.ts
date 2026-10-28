import { useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import { newId } from "../store/state";
import type { Book, Highlight } from "../types";
import * as accountApi from "./accountApi";

type Draft = Omit<Highlight, "id" | "createdAt" | "bookId">;

/**
 * Highlights and notes for one book in the reader. Like bookmarks: real accounts save to
 * Supabase first, then show; in-memory accounts change the store straight away. Each change
 * rejects with an AccountError the reader shows. `ensureInLibrary` comes from useReading, since
 * a highlight belongs to a book in the library.
 */
export function useHighlights(book: Book, ensureInLibrary: () => Promise<void>) {
  const { state, dispatch } = useStore();
  const remote = Boolean(state.account?.userId);
  const highlights = activeReading(state)
    .highlights.filter((h) => h.bookId === book.id)
    .sort((a, b) => a.chapterIndex - b.chapterIndex || a.page - b.page || a.start - b.start);

  async function add(draft: Draft): Promise<Highlight> {
    const full = { ...draft, bookId: book.id, note: draft.note?.trim() || null };
    if (remote) {
      await ensureInLibrary();
      const saved = await accountApi.addHighlight(full);
      dispatch({ type: "addHighlight", highlight: saved });
      return saved;
    }
    const highlight: Highlight = { ...full, id: newId(), createdAt: Date.now() };
    dispatch({ type: "addHighlight", highlight });
    return highlight;
  }

  async function update(id: string, patch: Partial<Pick<Highlight, "color" | "note">>) {
    const clean = patch.note === undefined ? patch : { ...patch, note: patch.note?.trim() || null };
    if (remote) await accountApi.updateHighlight(id, clean);
    dispatch({ type: "updateHighlight", id, patch: clean });
  }

  async function remove(id: string) {
    if (remote) await accountApi.removeHighlight(id);
    dispatch({ type: "removeHighlight", id });
  }

  return { highlights, add, update, remove };
}
