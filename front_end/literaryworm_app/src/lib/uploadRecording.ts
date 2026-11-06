import { books, isAllowed } from "../data/books";
import type { AgeRating, Book, UploadedBook } from "../types";

/**
 * A human narrator for an uploaded book: when an upload is one of the catalog's public-domain
 * titles (matched by title and the author's surname), its LibriVox recording can be played
 * instead of a device voice. Worked out in the browser from the upload's title and author only;
 * nothing is sent anywhere. The recording is the catalog title's, so listening to it keeps its
 * own place, separate from the upload's.
 */

/** Lower case, no accents or punctuation, single spaces. */
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A title as both sides can be compared: no bracketed notes ("(The Lantern Coast, #1)",
 * "[Illustrated]"), no subtitle ("Frankenstein; Or, The Modern Prometheus", "Emma: A Novel"),
 * no leading article.
 */
export function mainTitle(title: string): string {
  const main = title
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .split(/[:;]|\s[-–—]\s|,\s*or\b/i)[0];
  return fold(main).replace(/^(the|a|an) /, "");
}

/**
 * The surnames an upload's author line names: "Mary Shelley", "Shelley, Mary Wollstonecraft"
 * (as Project Gutenberg's EPUBs have it) and "Austen & Brontë" all work.
 */
export function surnames(author: string): string[] {
  return author
    .split(/\s*(?:&|\band\b|;)\s*/i)
    .map((name) => {
      const [before, after] = name.split(",");
      // "Shelley, Mary": the surname comes first. "Mary Shelley, Jr.": a suffix after the comma.
      const surname = after !== undefined && fold(after) && !/^(jr|sr|ii|iii|iv)$/.test(fold(after)) ? before : name.replace(/,.*$/, "");
      return fold(surname).split(" ").filter(Boolean).at(-1) ?? "";
    })
    .filter(Boolean);
}

/**
 * The catalog title with a LibriVox recording that this upload is, if the profile may see it.
 * Needs the author: a title alone ("Emma", "Poems") is too easily someone else's book.
 */
export function recordingFor(
  upload: Pick<UploadedBook, "title" | "author">,
  ageRating: AgeRating,
  catalog: readonly Book[] = books,
): Book | null {
  const title = mainTitle(upload.title);
  const names = surnames(upload.author);
  if (!title || names.length === 0) return null;
  return (
    catalog.find(
      (b) =>
        b.recording &&
        isAllowed(b.ageRating, ageRating) &&
        mainTitle(b.title) === title &&
        names.some((name) => fold(b.author).split(" ").includes(name)),
    ) ?? null
  );
}
