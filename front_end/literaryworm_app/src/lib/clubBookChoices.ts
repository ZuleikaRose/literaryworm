import type { Book, UploadedBook } from "../types";
import { type ClubBookSort, type SeriesPlace, seriesInTitle, sortClubBooks } from "./librarySort";
import { seriesOf } from "./series";

/** A book offered when starting a club: a LiteraryWorm title or one of the profile's uploads. */
export interface ClubBookChoice {
  id: string;
  title: string;
  author: string;
  series?: SeriesPlace;
}

/** A catalog title, with its series and number from the catalog. */
export function catalogChoice(book: Book): ClubBookChoice {
  const series = seriesOf(book.id);
  const at = series ? series.ids.indexOf(book.id) : -1;
  return { id: book.id, title: book.title, author: book.author, series: series && at >= 0 ? { name: series.name, order: at + 1 } : undefined };
}

/** An uploaded EPUB, with the series its title names (such as "(The Expanse, #1)"), if any. */
export function uploadChoice(upload: Pick<UploadedBook, "id" | "title" | "author">): ClubBookChoice {
  return { id: upload.id, title: upload.title, author: upload.author, series: seriesInTitle(upload.title) };
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
