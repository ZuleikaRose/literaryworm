import { ageRatingLabel, listenMinutes } from "../data/books";
import { releaseDay, releaseLabel } from "./release";
import type { Book } from "../types";
import type { VolumeDetail } from "./booksApi";

/** What the details page shows, whichever source the book came from. */
export interface DetailView {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  /** https cover from Google Books; null draws one. */
  coverUrl: string | null;
  /**
   * When the book is first out, from Google Books: the day (YYYY-MM-DD), how to say it, and
   * whether Google gave the exact day (Remind Me needs one). Null when there's no date.
   */
  release: { date: string; label: string; exact: boolean } | null;
  /** Set for LiteraryWorm catalog titles (drawn cover, Read and Listen). */
  local?: Book;
  description: string | null;
  /** First category and year, above the title. */
  kicker: string;
  categories: string[];
  averageRating: number | null;
  ratingsCount: number | null;
  pageCount: number | null;
  /** The extra fields the brief asks for, as a definition list. */
  facts: Fact[];
  /** Google's page for the title, credited on the page. */
  googleLink: string | null;
}

const languageNames = new Intl.DisplayNames(undefined, { type: "language" });

function languageName(code: string | null): string | null {
  if (!code) return null;
  try {
    return languageNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "2016-05-03" → "May 3, 2016"; "2016-05" → "May 2016"; "2016" stays. */
function publishedLabel(date: string | null): string | null {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (!month) return String(year);
  const options: Intl.DateTimeFormatOptions = day ? { dateStyle: "long" } : { year: "numeric", month: "long" };
  return new Intl.DateTimeFormat(undefined, options).format(new Date(Date.UTC(year, month - 1, day || 1)));
}

function hoursLabel(minutes: number): string {
  const whole = Math.round(minutes);
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return h ? `${h} hr ${m} min` : `${m} min`;
}

function releaseOf(published: string | null): DetailView["release"] {
  const date = releaseDay(published);
  if (!date || !published) return null;
  return { date, label: releaseLabel(date, published.slice(0, 10)), exact: /^\d{4}-\d{2}-\d{2}/.test(published) };
}

/** A line of Book details. A narrator's value starts with their name, which links to their page. */
export interface Fact {
  label: string;
  value: string;
  wide?: boolean;
  narrator?: string;
}

function compact(facts: (Omit<Fact, "value"> & { value: string | null })[]) {
  return facts.filter((f): f is Fact => Boolean(f.value));
}

export function fromCatalogBook(book: Book): DetailView {
  return {
    id: book.id,
    title: book.title,
    subtitle: book.series ? `${book.series.name}, book ${book.series.order}` : null,
    authors: [book.author],
    coverUrl: null,
    local: book,
    description: book.synopsis,
    kicker: [book.genres[0], book.year].filter(Boolean).join(" · "),
    categories: book.genres,
    averageRating: book.rating,
    ratingsCount: book.ratingsCount,
    pageCount: book.pages,
    facts: compact([
      {
        label: "Narrator",
        value: book.recording ? `${book.recording.narrator} (LibriVox recording)` : (book.narrator ?? null),
        narrator: book.recording?.narrator ?? book.narrator,
      },
      { label: "Publisher", value: book.publisher },
      { label: "Published", value: String(book.year) },
      { label: "Length", value: `${book.pages} pages · ${hoursLabel(listenMinutes(book))} listening` },
      { label: "Format", value: book.formats.map((f) => (f === "ebook" ? "Ebook" : "Audiobook")).join(" and ") },
      { label: "Language", value: book.language },
      { label: "Age rating", value: ageRatingLabel[book.ageRating] },
      { label: "Content notes", value: book.contentNotes?.join(", ") ?? null, wide: true },
    ]),
    googleLink: null,
    release: null,
  };
}

export function fromVolume(volume: VolumeDetail): DetailView {
  return {
    id: volume.id,
    title: volume.title,
    subtitle: volume.subtitle,
    authors: volume.authors,
    coverUrl: volume.cover,
    description: volume.description,
    kicker: [volume.categories[0]?.split(" / ")[0], volume.publishedYear].filter(Boolean).join(" · "),
    categories: volume.categories,
    averageRating: volume.averageRating,
    ratingsCount: volume.ratingsCount,
    pageCount: volume.pageCount,
    facts: compact([
      { label: "Publisher", value: volume.publisher },
      { label: "Published", value: publishedLabel(volume.publishedDate) },
      { label: "Pages", value: volume.pageCount ? String(volume.pageCount) : null },
      { label: "Language", value: languageName(volume.language) },
      { label: "Categories", value: volume.categories.join(" · ") || null, wide: true },
    ]),
    googleLink: volume.previewLink,
    release: releaseOf(volume.publishedDate),
  };
}

/** Up to two letters for a reader's avatar. */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
