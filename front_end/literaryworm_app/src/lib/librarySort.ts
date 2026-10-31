import type { LibraryEntry } from "../types";

/** How My Library can be ordered (`?sort=` in the address; "added" when it's missing). */
export type LibrarySort = "added" | "added-oldest" | "updated" | "title" | "title-desc" | "numbers" | "author" | "published" | "published-oldest";

export const LIBRARY_SORTS: { value: LibrarySort; label: string }[] = [
  { value: "added", label: "Recently added" },
  { value: "added-oldest", label: "Oldest added" },
  { value: "updated", label: "Recently changed" },
  { value: "title", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "numbers", label: "Numbers first (0–9)" },
  { value: "author", label: "Author A–Z" },
  { value: "published", label: "Published, newest" },
  { value: "published-oldest", label: "Published, oldest" },
];

/** Uploaded books: when they were uploaded, or by title. */
export type UploadSort = "uploaded" | "uploaded-oldest" | "title" | "title-desc";

export const UPLOAD_SORTS: { value: UploadSort; label: string }[] = [
  { value: "uploaded", label: "Date uploaded, newest" },
  { value: "uploaded-oldest", label: "Date uploaded, oldest" },
  { value: "title", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
];

export function readLibrarySort(raw: string | null): LibrarySort {
  return LIBRARY_SORTS.some((s) => s.value === raw) ? (raw as LibrarySort) : "added";
}

export function readUploadSort(raw: string | null): UploadSort {
  return UPLOAD_SORTS.some((s) => s.value === raw) ? (raw as UploadSort) : "uploaded";
}

/** What sorting needs to know about a book that the entry may not carry itself. */
export interface SortDetails {
  title: string;
  author: string;
  /** The year it was published, or null when we don't know. */
  year: number | null;
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
      case "published":
      case "published-oldest": {
        const ya = x.d.year;
        const yb = y.d.year;
        if (ya === null || yb === null) order = ya === yb ? 0 : ya === null ? 1 : -1;
        else order = sort === "published" ? yb - ya : ya - yb;
        break;
      }
    }
    return order || byTitle(x.d, y.d) || b.addedAt - a.addedAt;
  });
  return keyed.map((k) => k.entry);
}

export function sortUploads<T extends { title: string; createdAt: number }>(books: T[], sort: UploadSort): T[] {
  return [...books].sort((a, b) => {
    switch (sort) {
      case "uploaded":
        return b.createdAt - a.createdAt;
      case "uploaded-oldest":
        return a.createdAt - b.createdAt;
      case "title":
        return collator.compare(sortTitle(a.title), sortTitle(b.title)) || b.createdAt - a.createdAt;
      case "title-desc":
        return collator.compare(sortTitle(b.title), sortTitle(a.title)) || b.createdAt - a.createdAt;
    }
  });
}
