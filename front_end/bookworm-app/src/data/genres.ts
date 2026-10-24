/** The six genres the assessment brief requires, in the order the UI lists them. */
export const browseGenres = [
  { id: "technology", label: "Technology" },
  { id: "adventure", label: "Adventure" },
  { id: "sci-fi", label: "Sci-Fi" },
  { id: "fiction", label: "Fiction" },
  { id: "non-fiction", label: "Non-Fiction" },
  { id: "horror", label: "Horror" },
] as const;

export type BrowseGenre = (typeof browseGenres)[number]["id"];

export function isBrowseGenre(value: string | null): value is BrowseGenre {
  return browseGenres.some((g) => g.id === value);
}

export function genreLabel(id: BrowseGenre): string {
  return browseGenres.find((g) => g.id === id)!.label;
}

/**
 * How each genre matches the sample catalog's own genres, used only when no backend is
 * configured. With Supabase, the books Edge Function maps genres to Google Books queries.
 */
export const sampleCatalogGenres: Record<BrowseGenre, string[]> = {
  technology: ["Technology"],
  adventure: ["Adventure"],
  "sci-fi": ["Science fiction"],
  fiction: ["Fiction", "Literary fiction", "Classics", "Fantasy", "Romance", "Mystery", "Young adult"],
  "non-fiction": ["Memoir", "Self-development"],
  horror: ["Horror"],
};

/**
 * The browse genre closest to a Google Books title's categories (for More like this), or
 * null when none fits. Google's categories are BISAC headings such as "Fiction / Horror".
 */
export function genreForCategories(categories: string[]): BrowseGenre | null {
  const text = categories.join(" ").toLowerCase();
  if (/science fiction|sci-fi/.test(text)) return "sci-fi";
  if (/horror/.test(text)) return "horror";
  if (/adventure/.test(text)) return "adventure";
  if (/computers|technology|engineering/.test(text)) return "technology";
  if (/fiction/.test(text)) return "fiction";
  return text ? "non-fiction" : null;
}
