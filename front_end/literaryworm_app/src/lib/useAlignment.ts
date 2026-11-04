import { useEffect, useState } from "react";
import type { Book } from "../types";
import { type Alignment, isAligned, parseAlignment } from "./alignment";

/** Alignments loaded this visit (null: missing or didn't fit the book). */
const loaded = new Map<string, Alignment | null>();

/**
 * The book's read-along alignment (public/alignments/<id>.json, lib/alignment.ts), for the pilot
 * books only, loaded once a visit. Null while loading, for other books, or if the file is missing or
 * doesn't fit the book (the transcript then stays hidden for the recording, as before).
 */
export function useAlignment(book: Book, wanted: boolean): Alignment | null {
  const key = book.id;
  const chapters = book.chapters.length;
  const needed = wanted && isAligned(key);
  // Bumped when a file arrives, so the render below reads it from `loaded`.
  const [, arrived] = useState(0);

  useEffect(() => {
    if (!needed || loaded.has(key)) return;
    let live = true;
    fetch(`/alignments/${encodeURIComponent(key)}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((raw: unknown) => parseAlignment(raw, chapters))
      .catch(() => null)
      .then((found) => {
        loaded.set(key, found);
        if (live) arrived((n) => n + 1);
      });
    return () => {
      live = false;
    };
  }, [key, needed, chapters]);

  return needed ? (loaded.get(key) ?? null) : null;
}
