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

// A catalog book's language is a name ("Greek"); an upload's is the EPUB's code ("el", "pt-BR").
const LANGUAGE_TAGS: Record<string, string> = { English: "en", French: "fr", German: "de", Spanish: "es", Italian: "it", Greek: "el" };

/**
 * The BCP 47 tag for a book's text, for `lang` on its title and the reader's page, so screen readers
 * read a Greek or French classic in its own language; English when it isn't known.
 */
export function bookLangTag(language: string | null | undefined): string {
  if (!language) return "en";
  if (LANGUAGE_TAGS[language]) return LANGUAGE_TAGS[language];
  return /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language) ? language : "en";
}
