import { useEffect, useState } from "react";
import { fetchBookPage, usesBackend } from "./booksApi";
import type { IsbnBook } from "./clubBookChoices";
import { tr } from "./i18n";
import { cleanIsbn } from "./search";

export interface IsbnLookup {
  /** The ISBN's digits when the search is a valid ISBN-10 or ISBN-13, else null. */
  isbn: string | null;
  /** Its editions on Google Books once looked up; null while looking or when it failed. */
  editions: IsbnBook[] | null;
  /** True once the lookup has answered (or failed). */
  done: boolean;
  failed: boolean;
  /** False in a copy without the backend, where Google Books can't be asked. */
  available: boolean;
}

/**
 * Looks an ISBN typed into a book search up on Google Books (the `books` function's isbn mode).
 * Neither the catalog nor uploads keep ISBNs, so callers match the editions by title and author
 * (`isbnMatches()` in lib/clubBookChoices.ts).
 */
export function useIsbnLookup(query: string): IsbnLookup {
  const isbn = cleanIsbn(query);
  const [answer, setAnswer] = useState<{ isbn: string; editions: IsbnBook[] | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!isbn || !usesBackend) return;
    let live = true;
    fetchBookPage({ mode: "isbn", isbn }, 1).then(
      (page) => live && setAnswer({ isbn, editions: page.items, failed: false }),
      () => live && setAnswer({ isbn, editions: null, failed: true }),
    );
    return () => {
      live = false;
    };
  }, [isbn]);
  const current = isbn && answer?.isbn === isbn ? answer : null;
  return { isbn, editions: current?.editions ?? null, done: current !== null, failed: current?.failed ?? false, available: usesBackend };
}

/** What to say under the search about an ISBN, or null when the search isn't one. */
export function isbnNoteFor(lookup: IsbnLookup, matches: number, where: "catalog" | "uploads"): string | null {
  if (!lookup.isbn) return null;
  if (!lookup.available) return tr("Finding a book by ISBN needs LiteraryWorm's servers, which this copy of the app doesn't use.");
  if (!lookup.done) return tr("Looking up that ISBN…");
  if (lookup.failed) return tr("We couldn't look up that ISBN just now. Try again, or search by title.");
  const first = lookup.editions?.[0];
  if (!first) return tr("Google Books doesn't know that ISBN. Check the digits, or search by title.");
  const book = first.authors[0]
    ? tr("ISBN {isbn}: {title} by {author}.", { isbn: lookup.isbn, title: first.title, author: first.authors[0] })
    : tr("ISBN {isbn}: {title}.", { isbn: lookup.isbn, title: first.title });
  if (matches > 0) return book;
  return `${book} ${where === "uploads" ? tr("None of your uploads is that book.") : tr("That book isn't a LiteraryWorm title: try My uploads.")}`;
}
