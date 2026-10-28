import { useEffect, useState } from "react";
import type { Book } from "../types";
import { bookText } from "./narration";
import { type ReaderPage, readerPages, textPages } from "./reading";

type Loaded = { bookId: string; pages: ReaderPage[] } | { bookId: string; error: string };

/**
 * The reader's pages. A public-domain title with a recording has its full Project Gutenberg text
 * (public/texts, the same text the device voices read), fetched once; so does a book the member
 * uploaded (lib/uploads.ts); other titles have sample pages.
 */
export function useBookPages(book: Book): { pages: ReaderPage[] | null; error: string | null; retry: () => void } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!book.recording && !book.upload) return;
    let live = true;
    bookText(book).then(
      (chapters) => {
        if (!live) return;
        // The text is built to match the recording's chapters; anything else is a stale file.
        if (chapters.length !== book.chapters.length) setLoaded({ bookId: book.id, error: "This book's text doesn't match its chapters. Try again later." });
        else setLoaded({ bookId: book.id, pages: textPages(chapters) });
      },
      (err: unknown) => live && setLoaded({ bookId: book.id, error: err instanceof Error ? err.message : "We couldn't load this book's text. Try again." }),
    );
    return () => {
      live = false;
    };
  }, [book, attempt]);

  if (!book.recording && !book.upload) return { pages: readerPages(book), error: null, retry: () => {} };
  const current = loaded?.bookId === book.id ? loaded : null;
  return {
    pages: current && "pages" in current ? current.pages : null,
    error: current && "error" in current ? current.error : null,
    retry: () => {
      setLoaded(null);
      setAttempt((n) => n + 1);
    },
  };
}
