/**
 * The genres to browse and search by, in the order the UI lists them: the six the assessment
 * brief requires first (`shelf`: each has its own row on Home), then the rest. The `books`
 * Edge Function's GENRES list must match.
 */
export const browseGenres = [
  { id: "technology", label: "Technology", shelf: true },
  { id: "adventure", label: "Adventure", shelf: true },
  { id: "sci-fi", label: "Sci-Fi", shelf: true },
  { id: "fiction", label: "Fiction", shelf: true },
  { id: "non-fiction", label: "Non-Fiction", shelf: true },
  { id: "horror", label: "Horror", shelf: true },
  { id: "fantasy", label: "Fantasy", shelf: false },
  { id: "mystery", label: "Mystery", shelf: false },
  { id: "thriller", label: "Thriller", shelf: false },
  { id: "romance", label: "Romance", shelf: false },
  { id: "classics", label: "Classics", shelf: false },
  { id: "historical-fiction", label: "Historical Fiction", shelf: false },
  { id: "young-adult", label: "Young Adult", shelf: false },
  { id: "children", label: "Children's", shelf: false },
  { id: "biography", label: "Biography & Memoir", shelf: false },
  { id: "history", label: "History", shelf: false },
  { id: "science", label: "Science", shelf: false },
  { id: "self-help", label: "Self-Help", shelf: false },
  { id: "poetry", label: "Poetry", shelf: false },
] as const;

export type BrowseGenre = (typeof browseGenres)[number]["id"];

export function isBrowseGenre(value: string | null): value is BrowseGenre {
  return browseGenres.some((g) => g.id === value);
}

export function genreLabel(id: BrowseGenre): string {
  return browseGenres.find((g) => g.id === id)!.label;
}

/**
 * A genre's place in the home feed: `/?genre=horror#discover` (technology, the default, has
 * no parameter). The #discover hash takes the page to the feed instead of the top, and keeps
 * it there while switching genres.
 */
export function genreHref(basePath: string, id: BrowseGenre): string {
  return `${basePath}${id === "technology" ? "" : `?genre=${id}`}#discover`;
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
  fantasy: ["Fantasy", "Mythology"],
  mystery: ["Mystery"],
  thriller: ["Thriller"],
  romance: ["Romance"],
  classics: ["Classics"],
  "historical-fiction": ["Historical fiction"],
  "young-adult": ["Young adult"],
  children: ["Children's"],
  biography: ["Memoir", "Biography"],
  history: ["History"],
  science: ["Science"],
  "self-help": ["Self-development"],
  poetry: ["Poetry"],
};

/**
 * The browse genre closest to a Google Books title's categories (for More like this), or
 * null when none fits. Google's categories are BISAC headings such as "Fiction / Horror".
 */
export function genreForCategories(categories: string[]): BrowseGenre | null {
  const text = categories.join(" ").toLowerCase();
  if (/juvenile/.test(text)) return "children";
  if (/young adult/.test(text)) return "young-adult";
  if (/science fiction|sci-fi/.test(text)) return "sci-fi";
  if (/horror/.test(text)) return "horror";
  if (/fantasy/.test(text)) return "fantasy";
  if (/thriller|suspense/.test(text)) return "thriller";
  if (/mystery|detective/.test(text)) return "mystery";
  if (/romance/.test(text)) return "romance";
  if (/historical/.test(text)) return "historical-fiction";
  if (/classics/.test(text)) return "classics";
  if (/adventure/.test(text)) return "adventure";
  if (/poetry/.test(text)) return "poetry";
  if (/computers|technology|engineering/.test(text)) return "technology";
  if (/fiction/.test(text)) return "fiction";
  if (/biography|autobiography|memoir/.test(text)) return "biography";
  if (/self-help/.test(text)) return "self-help";
  if (/history/.test(text)) return "history";
  if (/science|nature|mathematics/.test(text)) return "science";
  return text ? "non-fiction" : null;
}

/**
 * A saved favourite genre as one of the browse genres' labels. Favourites are the browse
 * genres (Sci-Fi, Fantasy…); ones chosen before, from the sample catalog's own genres
 * (Science fiction, Memoir…), become the browse genre that covers them. Null if none does.
 */
export function favouriteGenreLabel(saved: string): string | null {
  const key = saved.toLowerCase();
  const byLabel = browseGenres.find((g) => g.label.toLowerCase() === key);
  if (byLabel) return byLabel.label;
  // The narrowest browse genre that covers it (Fiction covers almost everything); on a tie, the
  // more specific one, which comes later in the list (Memoir: Biography & Memoir, not Non-Fiction).
  const covering = browseGenres
    .map((g, index) => ({ g, index, size: sampleCatalogGenres[g.id].length }))
    .filter(({ g }) => sampleCatalogGenres[g.id].some((c) => c.toLowerCase() === key))
    .sort((a, b) => a.size - b.size || b.index - a.index);
  return covering[0]?.g.label ?? null;
}

/** The browse genre a favourite names (see favouriteGenreLabel), or null. */
export function favouriteGenreId(saved: string): BrowseGenre | null {
  const label = favouriteGenreLabel(saved);
  return browseGenres.find((g) => g.label === label)?.id ?? null;
}

/** Whether a catalog book is in a favourite genre. */
export function inFavouriteGenre(bookGenres: string[], favourite: string): boolean {
  const id = favouriteGenreId(favourite);
  const catalog = id ? sampleCatalogGenres[id] : [favourite];
  return bookGenres.some((g) => catalog.some((c) => c.toLowerCase() === g.toLowerCase()));
}
