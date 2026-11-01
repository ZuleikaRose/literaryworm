import { books, isAllowed } from "../data/books";
import type { AgeRating, Book } from "../types";

/**
 * Catalog books in a language other than English (the classics in French, German and Spanish,
 * `language` on the book), as a profile may see them: Discover's *In their own language* row and
 * Search's links (visitors are rated "all", like the rest of Search). Grouped by language in
 * alphabetical order, titles in catalog order.
 */
export function otherLanguageBooks(ageRating: AgeRating, catalog: Book[] = books): Book[] {
  // filter() makes a new array, so sorting it leaves the caller's list as it was.
  return catalog
    .filter((b) => !!b.language && b.language !== "English" && isAllowed(b.ageRating, ageRating))
    .sort((a, b) => a.language.localeCompare(b.language));
}
