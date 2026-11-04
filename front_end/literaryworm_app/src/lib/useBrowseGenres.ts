import { genresFor } from "../data/genres";
import { useActiveProfile } from "../store/context";
import { usesBackend } from "./booksApi";

/**
 * The genres to show the active reader (data/genres.ts genresFor()): every genre, or only those
 * with sample-catalog titles when their books come from the catalog alone, the same rule as
 * booksApi's fetchBookPage (no backend, or a Kids profile).
 */
export function useBrowseGenres() {
  const profile = useActiveProfile();
  return genresFor(!usesBackend || profile?.ageRating === "kids");
}
