import type { LibraryEntry } from "../types";

/** How My Library can be ordered (`?sort=` in the address; "added" when it's missing). */
export type LibrarySort = "added" | "added-oldest" | "updated" | "title" | "title-desc" | "numbers" | "author" | "author-desc" | "published" | "published-oldest" | "series";

export const LIBRARY_SORTS: { value: LibrarySort; label: string }[] = [
  { value: "added", label: "Recently added" },
  { value: "added-oldest", label: "Oldest added" },
  { value: "updated", label: "Recently changed" },
  { value: "title", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "numbers", label: "Numbers first (0–9)" },
  { value: "author", label: "Author A–Z" },
  { value: "author-desc", label: "Author Z–A" },
  { value: "published", label: "Published, newest" },
  { value: "published-oldest", label: "Published, oldest" },
  { value: "series", label: "Series, in reading order" },
];

/** Uploaded books sort the same eleven ways as the rest of My Library ("added" when it's missing). */
export type UploadSort = LibrarySort;

export const UPLOAD_SORTS = LIBRARY_SORTS;

/** The book list when starting a book club: the same eleven sorts as My Library. */
export type ClubBookSort = LibrarySort;

export const CLUB_BOOK_SORTS = LIBRARY_SORTS;

export function readLibrarySort(raw: string | null): LibrarySort {
  return LIBRARY_SORTS.some((s) => s.value === raw) ? (raw as LibrarySort) : "added";
}

/** Addresses saved before uploads had all ten sorts said "uploaded" and "uploaded-oldest". */
export function readUploadSort(raw: string | null): UploadSort {
  if (raw === "uploaded") return "added";
  if (raw === "uploaded-oldest") return "added-oldest";
  return readLibrarySort(raw);
}

/** What sorting needs to know about a book that the entry may not carry itself. */
export interface SortDetails {
  title: string;
  author: string;
  /** The year it was published, or null when we don't know. */
  year: number | null;
  /** Its series and place in it, when it's in one (for *Series, in reading order*). */
  series?: SeriesPlace;
}

// Numeric collation: "2 States" comes before "10 Minutes", and case and accents don't matter.
const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Leading "The", "A" and "An" don't count, as on a bookshop shelf. */
export function sortTitle(title: string): string {
  return title.trim().replace(/^(the|an?)\s+/i, "");
}

/** The surname is the last word of the first author ("Ursula K. Le Guin" sorts as "Guin"; good enough for a shelf). */
export function authorKey(author: string): string {
  const first = author.split(",")[0].trim();
  const words = first.split(/\s+/);
  return `${words[words.length - 1] ?? ""} ${first}`;
}

const startsWithNumber = (title: string) => /^\d/.test(sortTitle(title));

/** The year at the start of Google's publishedDate ("2019-05-02", "2019"), or null. */
export function publishedYear(date: string | null | undefined): number | null {
  const match = date?.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

const byTitle = (a: SortDetails, b: SortDetails) => collator.compare(sortTitle(a.title), sortTitle(b.title));

/** Each series together (A–Z) in reading order, before the books in none. */
function bySeries(a: SeriesPlace | undefined, b: SeriesPlace | undefined): number {
  if (!a || !b) return a === b ? 0 : a ? -1 : 1;
  return collator.compare(a.name, b.name) || a.order - b.order;
}

/**
 * Orders library entries. Ties fall back to the title, then the newest added, so the order never
 * jumps about between renders. Books whose published year isn't known go last, either way round.
 */
export function sortLibrary(entries: LibraryEntry[], sort: LibrarySort, details: (entry: LibraryEntry) => SortDetails): LibraryEntry[] {
  const keyed = entries.map((entry) => ({ entry, d: details(entry) }));
  const changed = (e: LibraryEntry) => e.updatedAt ?? e.addedAt;
  keyed.sort((x, y) => {
    const a = x.entry;
    const b = y.entry;
    let order = 0;
    switch (sort) {
      case "added":
        order = b.addedAt - a.addedAt;
        break;
      case "added-oldest":
        order = a.addedAt - b.addedAt;
        break;
      case "updated":
        order = changed(b) - changed(a);
        break;
      case "title":
        order = byTitle(x.d, y.d);
        break;
      case "title-desc":
        order = byTitle(y.d, x.d);
        break;
      case "numbers":
        order = Number(startsWithNumber(y.d.title)) - Number(startsWithNumber(x.d.title)) || byTitle(x.d, y.d);
        break;
      case "author":
        order = collator.compare(authorKey(x.d.author), authorKey(y.d.author));
        break;
      case "author-desc":
        order = collator.compare(authorKey(y.d.author), authorKey(x.d.author));
        break;
      case "published":
      case "published-oldest": {
        const ya = x.d.year;
        const yb = y.d.year;
        if (ya === null || yb === null) order = ya === yb ? 0 : ya === null ? 1 : -1;
        else order = sort === "published" ? yb - ya : ya - yb;
        break;
      }
      case "series":
        order = bySeries(x.d.series, y.d.series);
        break;
    }
    return order || byTitle(x.d, y.d) || b.addedAt - a.addedAt;
  });
  return keyed.map((k) => k.entry);
}

/** What sorting uploads needs: the EPUB's details and when it was uploaded. */
export interface SortableUpload {
  title: string;
  author: string;
  createdAt: number;
  /** The year in the EPUB's date, when it gave one (uploads from before migration 6626 don't know). */
  publishedYear?: number | null;
}

/**
 * Orders uploads like My Library: "added" is when it was uploaded and "changed" is `changedAt`
 * (when it was last read, from its reading place), else when it was uploaded. Unknown published
 * years go last either way round. *Series* groups each series its title names (A–Z, see
 * `seriesInTitle()`) in reading order, then the books in none by title. Ties go by title, then
 * the newest upload, so the order never jumps about.
 */
export function sortUploads<T extends SortableUpload>(books: T[], sort: UploadSort, changedAt: (book: T) => number = (b) => b.createdAt): T[] {
  const title = (a: T, b: T) => collator.compare(sortTitle(a.title), sortTitle(b.title));
  return [...books].sort((a, b) => {
    let order = 0;
    switch (sort) {
      case "added":
        order = b.createdAt - a.createdAt;
        break;
      case "added-oldest":
        order = a.createdAt - b.createdAt;
        break;
      case "updated":
        order = changedAt(b) - changedAt(a);
        break;
      case "title":
        order = title(a, b);
        break;
      case "title-desc":
        order = title(b, a);
        break;
      case "numbers":
        order = Number(startsWithNumber(b.title)) - Number(startsWithNumber(a.title));
        break;
      case "author":
        order = collator.compare(authorKey(a.author), authorKey(b.author));
        break;
      case "author-desc":
        order = collator.compare(authorKey(b.author), authorKey(a.author));
        break;
      case "published":
      case "published-oldest": {
        const ya = a.publishedYear ?? null;
        const yb = b.publishedYear ?? null;
        if (ya === null || yb === null) order = ya === yb ? 0 : ya === null ? 1 : -1;
        else order = sort === "published" ? yb - ya : ya - yb;
        break;
      }
      case "series":
        order = bySeries(seriesInTitle(a.title), seriesInTitle(b.title));
        break;
    }
    return order || title(a, b) || b.createdAt - a.createdAt;
  });
}

/** A book's place in a series: its name and number (1 for the first). */
export interface SeriesPlace {
  name: string;
  order: number;
}

// "Leviathan Wakes (The Expanse, #1)" or "Dune (Dune Chronicles #1)": how EPUBs and Goodreads name a series.
const SERIES_IN_TITLE = /\(([^()]+?),?\s*#(\d+(?:\.\d+)?)\)\s*$/;

/** The series an uploaded book's title names, if it names one the usual way. */
export function seriesInTitle(title: string): SeriesPlace | undefined {
  const match = title.match(SERIES_IN_TITLE);
  return match ? { name: match[1].trim(), order: Number(match[2]) } : undefined;
}

/** What sorting a club's book choices needs. */
export interface SortableChoice {
  id: string;
  title: string;
  author: string;
  /** When it went into the profile's library, or was uploaded; missing when it isn't in the library. */
  addedAt?: number;
  /** When it was last read or changed; missing when it isn't in the library. */
  changedAt?: number;
  /** The year it was published, when known. */
  year?: number | null;
}

/**
 * Orders the books offered when starting a club, the same eleven ways as My Library. Titles drop
 * a leading The/A/An and compare numbers as numbers; authors go by surname; books without a date
 * (not in the library) or a year go last either way round; *Series* groups each series (A–Z) in
 * reading order, then the books in none. Ties go by title, then id, so the order never jumps.
 */
export function sortClubBooks<T extends SortableChoice>(books: T[], sort: ClubBookSort, seriesFor: (book: T) => SeriesPlace | undefined): T[] {
  const title = (a: T, b: T) => collator.compare(sortTitle(a.title), sortTitle(b.title));
  // Known values first, newest or oldest first as asked; unknown ones after.
  const known = (a: number | null | undefined, b: number | null | undefined, newest: boolean) => {
    if (a == null || b == null) return a == null && b == null ? 0 : a == null ? 1 : -1;
    return newest ? b - a : a - b;
  };
  return [...books].sort((a, b) => {
    let order = 0;
    switch (sort) {
      case "added":
        order = known(a.addedAt, b.addedAt, true);
        break;
      case "added-oldest":
        order = known(a.addedAt, b.addedAt, false);
        break;
      case "updated":
        order = known(a.changedAt ?? a.addedAt, b.changedAt ?? b.addedAt, true);
        break;
      case "title":
        order = title(a, b);
        break;
      case "title-desc":
        order = title(b, a);
        break;
      case "author":
        order = collator.compare(authorKey(a.author), authorKey(b.author));
        break;
      case "author-desc":
        order = collator.compare(authorKey(b.author), authorKey(a.author));
        break;
      case "numbers":
        order = Number(startsWithNumber(b.title)) - Number(startsWithNumber(a.title));
        break;
      case "published":
        order = known(a.year, b.year, true);
        break;
      case "published-oldest":
        order = known(a.year, b.year, false);
        break;
      case "series":
        order = bySeries(seriesFor(a), seriesFor(b));
        break;
    }
    return order || title(a, b) || a.id.localeCompare(b.id);
  });
}
