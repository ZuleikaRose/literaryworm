import { getBook } from "../data/books";
import { useProfileData, useStore } from "../store/context";
import { activeLibrary, activeReading } from "../store/reducer";
import type { Highlight } from "../types";
import type { BookNotes } from "./exportNotes";

/** Title, author and chapter titles for a book's notes, from the catalog, an upload or the library entry. */
export function useNotesBooks(): (BookNotes & { bookId: string })[] {
  const { state } = useStore();
  const library = activeLibrary(state);
  const uploads = useProfileData().uploads;
  const byBook = new Map<string, Highlight[]>();
  for (const h of activeReading(state).highlights) byBook.set(h.bookId, [...(byBook.get(h.bookId) ?? []), h]);
  return [...byBook.entries()]
    .map(([bookId, highlights]) => {
      const book = getBook(bookId);
      const upload = uploads.find((u) => u.id === bookId);
      const entry = library[bookId];
      return {
        bookId,
        title: book?.title ?? upload?.title ?? entry?.title ?? "Untitled book",
        author: book?.author ?? upload?.author ?? entry?.authors?.[0] ?? null,
        chapterTitles: book?.chapters.map((c) => c.title) ?? upload?.chapterTitles ?? [],
        highlights,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

