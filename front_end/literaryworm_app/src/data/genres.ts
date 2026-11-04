import { tk } from "../lib/i18n";
/**
 * The genres to browse and search by, in the order the UI lists them: the six the assessment
 * brief requires first (`shelf`: each has its own row on Home), then the rest, then every other
 * top-level Google Books (BISAC) subject. The `books` Edge Function's GENRES list must match.
 */
export const browseGenres = [
  { id: "technology", label: tk("Technology"), shelf: true },
  { id: "adventure", label: tk("Adventure"), shelf: true },
  { id: "sci-fi", label: tk("Sci-Fi"), shelf: true },
  { id: "fiction", label: tk("Fiction"), shelf: true },
  { id: "non-fiction", label: tk("Non-Fiction"), shelf: true },
  { id: "horror", label: tk("Horror"), shelf: true },
  { id: "fantasy", label: tk("Fantasy"), shelf: false },
  { id: "mystery", label: tk("Mystery"), shelf: false },
  { id: "thriller", label: tk("Thriller"), shelf: false },
  { id: "romance", label: tk("Romance"), shelf: false },
  { id: "classics", label: tk("Classics"), shelf: false },
  { id: "historical-fiction", label: tk("Historical Fiction"), shelf: false },
  { id: "young-adult", label: tk("Young Adult"), shelf: false },
  { id: "children", label: tk("Children's"), shelf: false },
  { id: "biography", label: tk("Biography & Memoir"), shelf: false },
  { id: "history", label: tk("History"), shelf: false },
  { id: "science", label: tk("Science"), shelf: false },
  { id: "self-help", label: tk("Self-Help"), shelf: false },
  { id: "poetry", label: tk("Poetry"), shelf: false },
  { id: "lgbtqia", label: tk("LGBTQIA+"), shelf: false },
  // Every other top-level Google Books (BISAC) subject, A to Z, none repeating one above.
  { id: "antiques", label: tk("Antiques & Collectibles"), shelf: false },
  { id: "architecture", label: tk("Architecture"), shelf: false },
  { id: "art", label: tk("Art"), shelf: false },
  { id: "bibles", label: tk("Bibles"), shelf: false },
  { id: "body-mind-spirit", label: tk("Body, Mind & Spirit"), shelf: false },
  { id: "business", label: tk("Business & Economics"), shelf: false },
  { id: "comics", label: tk("Comics & Graphic Novels"), shelf: false },
  { id: "computers", label: tk("Computers"), shelf: false },
  { id: "cooking", label: tk("Cooking"), shelf: false },
  { id: "crafts", label: tk("Crafts & Hobbies"), shelf: false },
  { id: "design", label: tk("Design"), shelf: false },
  { id: "drama", label: tk("Drama"), shelf: false },
  { id: "education", label: tk("Education"), shelf: false },
  { id: "family", label: tk("Family & Relationships"), shelf: false },
  { id: "foreign-language", label: tk("Foreign Language Study"), shelf: false },
  { id: "games", label: tk("Games & Activities"), shelf: false },
  { id: "gardening", label: tk("Gardening"), shelf: false },
  { id: "health", label: tk("Health & Fitness"), shelf: false },
  { id: "house-home", label: tk("House & Home"), shelf: false },
  { id: "humor", label: tk("Humor"), shelf: false },
  { id: "juvenile-nonfiction", label: tk("Children's Non-Fiction"), shelf: false },
  { id: "language-arts", label: tk("Language Arts"), shelf: false },
  { id: "law", label: tk("Law"), shelf: false },
  { id: "literary-collections", label: tk("Literary Collections"), shelf: false },
  { id: "literary-criticism", label: tk("Literary Criticism"), shelf: false },
  { id: "mathematics", label: tk("Mathematics"), shelf: false },
  { id: "medical", label: tk("Medical"), shelf: false },
  { id: "music", label: tk("Music"), shelf: false },
  { id: "nature", label: tk("Nature"), shelf: false },
  { id: "performing-arts", label: tk("Performing Arts"), shelf: false },
  { id: "pets", label: tk("Pets"), shelf: false },
  { id: "philosophy", label: tk("Philosophy"), shelf: false },
  { id: "photography", label: tk("Photography"), shelf: false },
  { id: "political-science", label: tk("Political Science"), shelf: false },
  { id: "psychology", label: tk("Psychology"), shelf: false },
  { id: "reference", label: tk("Reference"), shelf: false },
  { id: "religion", label: tk("Religion"), shelf: false },
  { id: "social-science", label: tk("Social Science"), shelf: false },
  { id: "sports", label: tk("Sports & Recreation"), shelf: false },
  { id: "study-aids", label: tk("Study Aids"), shelf: false },
  { id: "transportation", label: tk("Transportation"), shelf: false },
  { id: "travel", label: tk("Travel"), shelf: false },
  { id: "true-crime", label: tk("True Crime"), shelf: false },
  { id: "young-adult-nonfiction", label: tk("Young Adult Non-Fiction"), shelf: false },
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
  // Carmilla and The Picture of Dorian Gray; Google Books adds many more.
  lgbtqia: ["LGBTQIA+"],
  // The catalog has no titles in most of the BISAC subjects; Kids profiles and copies without the
  // backend aren't offered those (catalogGenres), and Google Books fills them for everyone else.
  antiques: [],
  architecture: [],
  art: [],
  bibles: [],
  "body-mind-spirit": [],
  business: [],
  comics: [],
  computers: [],
  cooking: [],
  crafts: [],
  design: [],
  drama: [],
  education: [],
  family: ["Family"],
  "foreign-language": [],
  games: [],
  gardening: [],
  health: [],
  "house-home": [],
  humor: [],
  "juvenile-nonfiction": [],
  "language-arts": [],
  law: [],
  "literary-collections": [],
  "literary-criticism": [],
  mathematics: [],
  medical: [],
  music: [],
  nature: [],
  "performing-arts": [],
  pets: [],
  philosophy: [],
  photography: [],
  "political-science": [],
  psychology: [],
  reference: [],
  religion: [],
  "social-science": [],
  sports: [],
  "study-aids": [],
  transportation: [],
  travel: [],
  "true-crime": [],
  "young-adult-nonfiction": [],
};

/** Top-level BISAC headings (the part of a Google category before " / ") that are a genre of their own. */
const BISAC_HEADINGS: Record<string, BrowseGenre> = {
  "antiques & collectibles": "antiques",
  "architecture": "architecture",
  "art": "art",
  "bibles": "bibles",
  "body, mind & spirit": "body-mind-spirit",
  "business & economics": "business",
  "comics & graphic novels": "comics",
  "computers": "computers",
  "cooking": "cooking",
  "crafts & hobbies": "crafts",
  "design": "design",
  "drama": "drama",
  "education": "education",
  "family & relationships": "family",
  "foreign language study": "foreign-language",
  "games & activities": "games",
  "gardening": "gardening",
  "health & fitness": "health",
  "house & home": "house-home",
  "humor": "humor",
  "juvenile nonfiction": "juvenile-nonfiction",
  "language arts & disciplines": "language-arts",
  "law": "law",
  "literary collections": "literary-collections",
  "literary criticism": "literary-criticism",
  "mathematics": "mathematics",
  "medical": "medical",
  "music": "music",
  "nature": "nature",
  "performing arts": "performing-arts",
  "pets": "pets",
  "philosophy": "philosophy",
  "photography": "photography",
  "political science": "political-science",
  "psychology": "psychology",
  "reference": "reference",
  "religion": "religion",
  "social science": "social-science",
  "sports & recreation": "sports",
  "study aids": "study-aids",
  "transportation": "transportation",
  "travel": "travel",
  "true crime": "true-crime",
  "young adult nonfiction": "young-adult-nonfiction",
};

/** The genres the sample catalog has titles in. */
export const catalogGenres = browseGenres.filter((g) => sampleCatalogGenres[g.id].length > 0);

/**
 * The genres a reader is offered: all of them, or, when their books come only from the sample
 * catalog (Kids profiles, a copy without the backend), just the ones it has titles in.
 */
export function genresFor(sampleOnly: boolean): readonly (typeof browseGenres)[number][] {
  return sampleOnly ? catalogGenres : browseGenres;
}

/**
 * The browse genre closest to a Google Books title's categories (for More like this), or
 * null when none fits. Google's categories are BISAC headings such as "Fiction / Horror".
 */
export function genreForCategories(categories: string[]): BrowseGenre | null {
  const text = categories.join(" ").toLowerCase();
  // A subject with a genre of its own, by its top-level heading (so Fiction / Religious stays fiction).
  const headings = categories.map((c) => BISAC_HEADINGS[c.split("/")[0].trim().toLowerCase()]);
  const nonFiction = headings.find((h) => h === "juvenile-nonfiction" || h === "young-adult-nonfiction");
  if (nonFiction) return nonFiction;
  if (/juvenile/.test(text)) return "children";
  if (/young adult/.test(text)) return "young-adult";
  // BISAC's LGBTQ+ categories, and the older Gay and Lesbian ones.
  if (/lgbt|\bgay\b|lesbian|bisexual|transgender|queer|intersex|asexual/.test(text)) return "lgbtqia";
  const subject = headings.find(Boolean);
  if (subject) return subject;
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
