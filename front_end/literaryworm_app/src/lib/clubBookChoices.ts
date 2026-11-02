import type { Book, UploadedBook } from "../types";
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
}

/** How the club form's book search reads what's typed: title, author or ISBN as before, or keywords. */
export type ClubBookSearchBy = "title-author-isbn" | "keywords";

export const CLUB_BOOK_SEARCH_BY: { value: ClubBookSearchBy; label: string }[] = [
  { value: "title-author-isbn", label: "Title, author or ISBN" },
  { value: "keywords", label: "Keywords" },
];

/** Whether a choice has every keyword, from the start of a word, anywhere in its title, author or keyword text. */
export function keywordMatch(choice: ClubBookChoice, q: string): boolean {
  return wordsMatch(`${choice.title} ${choice.author} ${choice.keywords ?? ""}`, q);
}

/** A catalog title, with its series and number from the catalog. */
export function catalogChoice(book: Book): ClubBookChoice {
  const series = seriesOf(book.id);
  const at = series ? series.ids.indexOf(book.id) : -1;
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    series: series && at >= 0 ? { name: series.name, order: at + 1 } : undefined,
    keywords: keywordText(book),
  };
}

/**
 * An uploaded EPUB, with the series its title names (such as "(The Expanse, #1)"), if any; its
 * part names are what keywords look through besides the title and author.
 */
export function uploadChoice(upload: Pick<UploadedBook, "id" | "title" | "author"> & { chapterTitles?: string[] }): ClubBookChoice {
  return {
    id: upload.id,
    title: upload.title,
    author: upload.author,
    series: seriesInTitle(upload.title),
    keywords: upload.chapterTitles?.join(" ") ?? "",
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
