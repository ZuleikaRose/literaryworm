import type { Book, LibraryEntry, Progress, UploadedBook } from "../types";
import { sameBook } from "./importCsv";
import { type ClubBookSort, type SeriesPlace, seriesInTitle, sortClubBooks } from "./librarySort";
import { keywordText, wordsMatch } from "./search";
import { seriesOf } from "./series";

/** A book offered when starting a club: a LiteraryWorm title or one of the profile's uploads. */
export interface ClubBookChoice {
  id: string;
  title: string;
  author: string;
  series?: SeriesPlace;
  /** What a keyword search looks through besides the title and author (description, genres, part names). */
  keywords?: string;
  /** When it went into the profile's library (catalog) or was uploaded; missing when it isn't in the library. */
  addedAt?: number;
  /** When it was last read or its status changed; missing when it isn't in the library. */
  changedAt?: number;
  /** The year it was published: the catalog's, or the EPUB's when it gave one. */
  year?: number | null;
}

/** What the profile's library and reading places say about a book, for sorting by added or changed. */
export interface ChoiceActivity {
  entry?: Pick<LibraryEntry, "addedAt" | "updatedAt">;
  progress?: Pick<Progress, "updatedAt">;
}

const latest = (...times: (number | undefined)[]) => {
  const known = times.filter((t): t is number => t !== undefined);
  return known.length ? Math.max(...known) : undefined;
};

/** Whether a choice has every keyword, from the start of a word, anywhere in its title, author or keyword text. */
export function keywordMatch(choice: ClubBookChoice, q: string): boolean {
  return wordsMatch(`${choice.title} ${choice.author} ${choice.keywords ?? ""}`, q);
}

/** A catalog title, with its series and number from the catalog. */
export function catalogChoice(book: Book, activity: ChoiceActivity = {}): ClubBookChoice {
  const series = seriesOf(book.id);
  const at = series ? series.ids.indexOf(book.id) : -1;
  const { entry, progress } = activity;
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    series: series && at >= 0 ? { name: series.name, order: at + 1 } : undefined,
    keywords: keywordText(book),
    addedAt: entry?.addedAt,
    changedAt: entry ? latest(entry.updatedAt ?? entry.addedAt, progress?.updatedAt) : undefined,
    year: book.year,
  };
}

/**
 * An uploaded EPUB, with the series its title names (such as "(The Expanse, #1)"), if any; its
 * part names are what keywords look through besides the title and author.
 */
export function uploadChoice(
  upload: Pick<UploadedBook, "id" | "title" | "author"> & Partial<Pick<UploadedBook, "chapterTitles" | "createdAt" | "publishedYear">>,
  progress?: Pick<Progress, "updatedAt">,
): ClubBookChoice {
  return {
    id: upload.id,
    title: upload.title,
    author: upload.author,
    series: seriesInTitle(upload.title),
    keywords: upload.chapterTitles?.join(" ") ?? "",
    addedAt: upload.createdAt,
    // Last read, else when it was uploaded.
    changedAt: latest(upload.createdAt, progress?.updatedAt),
    year: upload.publishedYear ?? null,
  };
}

/** Every series among the choices, A–Z, for the Series filter. */
export function seriesNames(choices: ClubBookChoice[]): string[] {
  return [...new Set(choices.flatMap((c) => (c.series ? [c.series.name] : [])))].sort((a, b) => a.localeCompare(b));
}

/** "" = every book, "none" = books in no series, otherwise the books of that series. */
export type SeriesFilter = string;

/** The choices shown: matching the search (done by the caller) and the series filter, in the chosen order. */
export function arrangeChoices(choices: ClubBookChoice[], sort: ClubBookSort, series: SeriesFilter): ClubBookChoice[] {
  const kept = series === "" ? choices : series === "none" ? choices.filter((c) => !c.series) : choices.filter((c) => c.series?.name === series);
  return sortClubBooks(kept, sort, (c) => c.series);
}

/** The label in the Book list: title, author, and the series and number when there is one. */
export const choiceLabel = (c: ClubBookChoice) =>
  `${c.title}${c.author ? ` (${c.author})` : ""}${c.series && !c.title.includes(`#${c.series.order}`) ? ` · ${c.series.name} #${c.series.order}` : ""}`;

/** A book Google Books gives for an ISBN: its title and authors. */
export interface IsbnBook {
  title: string;
  authors: string[];
}

/**
 * The choices that are the book an ISBN names. Neither our catalog nor uploads keep ISBNs, so the
 * ISBN is looked up on Google Books (the `books` function's isbn mode) and its editions are matched
 * by title and author's surname (`sameBook()`, which ignores a series in brackets and subtitles).
 */
export function isbnMatches(choices: ClubBookChoice[], editions: IsbnBook[]): ClubBookChoice[] {
  return choices.filter((c) => editions.some((e) => sameBook({ title: c.title, author: c.author }, e)));
}

/** What a date sort goes by, said under Sort by; null for the sorts that need no explaining. */
export function clubSortNote(sort: ClubBookSort, source: "catalog" | "uploads"): string | null {
  const dated = sort === "added" || sort === "added-oldest" || sort === "updated";
  if (dated && source === "catalog") {
    return sort === "updated"
      ? "Books in your library come first, the one you read or changed last at the top."
      : "Books in your library come first, by when you added them.";
  }
  if (sort === "updated") return "The upload you read last comes first; ones you haven't opened go by when you uploaded them.";
  if ((sort === "published" || sort === "published-oldest") && source === "uploads") {
    return "Uses the year in each EPUB. Uploads without one, and any added before 2 November 2026, come last.";
  }
  return null;
}
