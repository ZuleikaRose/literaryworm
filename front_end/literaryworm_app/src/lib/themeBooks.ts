import { getBook } from "../data/books";
import type { ThemeBook } from "./challenges";
import { seriesOf } from "./series";

/** A finished book's details for theme challenges: catalog books only (others can't be told apart). */
export function themeBookOf(id: string): ThemeBook | undefined {
  const book = getBook(id);
  if (!book) return undefined;
  return { year: book.year, genres: book.genres, pages: book.pages, language: book.language, inSeries: Boolean(seriesOf(id)) };
}
