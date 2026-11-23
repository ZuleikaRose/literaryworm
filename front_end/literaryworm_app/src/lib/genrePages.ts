import { books, isAllowed } from "../data/books";
import { type BrowseGenre, browseGenres, genreHref, genreLabel, sampleCatalogGenres } from "../data/genres";
import type { AgeRating, Book } from "../types";

/**
 * Genre pages (/genres/:id, pages/Genre.tsx): one page per browse genre, with the catalog's own
 * titles in it and the Google Books feed below. Home's genre links used to be `/?genre=…`, which
 * named Home as their canonical, so Search Console listed every genre as an "Alternate page with
 * proper canonical tag"; vercel.json now sends those addresses here (genreRedirect.test.ts).
 * A genre with too few catalog titles is still a page for readers (Google Books fills it), but asks
 * not to be indexed and stays out of the sitemap, so no thin page is offered to search engines.
 */

/** A genre page is indexed once the catalog has at least this many titles in it for visitors. */
export const GENRE_MIN_BOOKS = 1;

/** How many catalog titles a genre page lists, in its structured data and for readers without JavaScript. */
export const GENRE_LIST_MAX = 60;

export const genrePath = (id: BrowseGenre) => genreHref("/", id);

/** "Fantasy books": the page's title and heading. */
export const genreTitle = (id: BrowseGenre) => `${genreLabel(id)} books`;

/** The catalog's titles in a genre that a profile may see: featured first, then the most rated. */
export function genreBooks(id: BrowseGenre, ageRating: AgeRating): Book[] {
  const names = new Set(sampleCatalogGenres[id]);
  return books
    .filter((b) => isAllowed(b.ageRating, ageRating) && b.genres.some((g) => names.has(g)))
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.ratingsCount - a.ratingsCount || a.title.localeCompare(b.title));
}

/** Whether a genre's page should be in search results (what a visitor sees decides). */
export const genreIndexable = (id: BrowseGenre) => genreBooks(id, "all").length >= GENRE_MIN_BOOKS;

/** The genres with pages worth indexing, in the order the app lists them. */
export const indexedGenres = (): BrowseGenre[] => browseGenres.map((g) => g.id).filter(genreIndexable);
