import { books, getBook, isAllowed } from "../data/books";
import { SERIES } from "../data/series";
import type { AgeRating, Book } from "../types";

/**
 * Series: the curated list in data/series.ts, plus books with `series` set in the catalog. A
 * series page is /series/:name; the book page shows the series and what comes next; Home's
 * *Continue the series* row offers the next book after one a profile finished.
 */
export interface Series {
  name: string;
  /** Catalog ids, in reading order. */
  ids: string[];
}

function buildSeries(): Series[] {
  const list: Series[] = SERIES.map((s) => ({ name: s.name, ids: s.ids.filter((id) => getBook(id)) }));
  const byName = new Map(list.map((s) => [s.name, s]));
  const listed = new Set(list.flatMap((s) => s.ids));
  const extra = books
    .filter((b) => b.series && !listed.has(b.id))
    .sort((a, b) => a.series!.order - b.series!.order);
  for (const b of extra) {
    const name = b.series!.name;
    const s = byName.get(name) ?? { name, ids: [] };
    if (!byName.has(name)) {
      byName.set(name, s);
      list.push(s);
    }
    s.ids.push(b.id);
  }
  return list.filter((s) => s.ids.length > 0);
}

export const allSeries: Series[] = buildSeries();
const seriesByBook = new Map(allSeries.flatMap((s) => s.ids.map((id) => [id, s] as const)));
const seriesByName = new Map(allSeries.map((s) => [s.name.toLowerCase(), s]));

export function seriesOf(bookId: string): Series | undefined {
  return seriesByBook.get(bookId);
}

export function seriesNamed(name: string | undefined): Series | undefined {
  return name ? seriesByName.get(name.toLowerCase()) : undefined;
}

export function seriesPath(name: string): string {
  return `/series/${encodeURIComponent(name)}`;
}

/** The books of a series a profile may see, in order. */
export function seriesBooks(series: Series, ageRating: AgeRating): Book[] {
  return series.ids.map((id) => getBook(id)!).filter((b) => isAllowed(b.ageRating, ageRating));
}

/** "Book 2 of 6 in Anne of Green Gables", counting only the books LiteraryWorm holds. */
export function seriesPlace(bookId: string): { series: Series; position: number; total: number } | null {
  const series = seriesOf(bookId);
  if (!series) return null;
  return { series, position: series.ids.indexOf(bookId) + 1, total: series.ids.length };
}

/** The next book in the series this profile may see, if there is one. */
export function nextInSeries(bookId: string, ageRating: AgeRating): Book | undefined {
  const series = seriesOf(bookId);
  if (!series) return undefined;
  const after = series.ids.slice(series.ids.indexOf(bookId) + 1);
  return after.map((id) => getBook(id)!).find((b) => isAllowed(b.ageRating, ageRating));
}

/**
 * Continue the series: for each series a profile has finished a book of, the first book after
 * the furthest one finished that isn't finished too. Newest-finished series first.
 */
export function continueSeries(finishedNewestFirst: string[], ageRating: AgeRating): Book[] {
  const finished = new Set(finishedNewestFirst);
  const seen = new Set<string>();
  const next: Book[] = [];
  for (const id of finishedNewestFirst) {
    const series = seriesOf(id);
    if (!series || seen.has(series.name)) continue;
    seen.add(series.name);
    const furthest = Math.max(...series.ids.map((x, i) => (finished.has(x) ? i : -1)));
    const book = series.ids
      .slice(furthest + 1)
      .map((x) => getBook(x)!)
      .find((b) => !finished.has(b.id) && isAllowed(b.ageRating, ageRating));
    if (book) next.push(book);
  }
  return next;
}
