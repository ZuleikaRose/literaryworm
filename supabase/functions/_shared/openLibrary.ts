// Open Library (openlibrary.org, the Internet Archive): a second source of book lists and details,
// so members' Home asks Google Books far less. Its catalogue data is public domain (CC0), so answers
// may be kept (OPEN_LIBRARY_KEEP_SECONDS). Requests name the app and a contact, as Open Library asks.
// Never sent: who is asking. Books from here have ids `ol-<work id>` (e.g. ol-OL8400950W).

import { HttpError } from "./http.ts";
import type { BookDetail, BookPage, BookSummary } from "./googleBooks.ts";
import { type Genre, PAGE_SIZE } from "./validate.ts";

const SITE = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org/b/id";
const TIMEOUT_MS = 8000;
export const USER_AGENT = "LiteraryWorm/1.0 (https://www.literaryworm.com; hello@literaryworm.com)";

/** Open Library's data is CC0, so an answer is kept a day (fresh enough for new books to show). */
export const OPEN_LIBRARY_KEEP_SECONDS = 24 * 60 * 60;

/** An Open Library book id as the app uses it: `ol-` and the work's id. */
export const OPEN_LIBRARY_ID = /^ol-OL\d{1,12}W$/;
export const isOpenLibraryId = (id: string): boolean => OPEN_LIBRARY_ID.test(id);

/** Each browse genre as an Open Library subject. */
export const OPEN_LIBRARY_SUBJECTS: Record<Genre, string> = {
  adventure: "adventure",
  technology: "technology",
  horror: "horror",
  "sci-fi": "science fiction",
  fiction: "fiction",
  "non-fiction": "nonfiction",
  fantasy: "fantasy",
  mystery: "mystery",
  thriller: "thrillers",
  romance: "romance",
  classics: "classic literature",
  "historical-fiction": "historical fiction",
  "young-adult": "young adult fiction",
  children: "juvenile fiction",
  biography: "biography",
  history: "history",
  science: "science",
  "self-help": "self-help",
  poetry: "poetry",
  lgbtqia: "lgbtq",
};

/**
 * Open Library has no maturity rating. Lists from it are only for adult ("All") profiles, and even
 * there, works it files as erotica are left out, as Google's not-mature lists did.
 */
export const MATURE_SUBJECT = /\berotic|\berotica\b|pornograph|\bbdsm\b/i;

const SEARCH_FIELDS = "key,title,author_name,first_publish_year,cover_i,subject,number_of_pages_median,publisher,language";

/** ISO 639-2 codes Open Library uses, as the two-letter codes the app shows. */
const LANGUAGES: Record<string, string> = { eng: "en", spa: "es", fre: "fr", fra: "fr", ger: "de", deu: "de", ita: "it", por: "pt", dut: "nl", nld: "nl" };

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown, max = 500): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strings = (v: unknown, maxItems = 10): string[] =>
  Array.isArray(v) ? v.map((s) => str(s, 200)).filter((s): s is string => s !== null).slice(0, maxItems) : [];

export function subjectUrl(genre: Genre, page: number): URL {
  const url = new URL(`${SITE}/search.json`);
  url.searchParams.set("subject", OPEN_LIBRARY_SUBJECTS[genre]);
  url.searchParams.set("fields", SEARCH_FIELDS);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("page", String(page + 1));
  return url;
}

export function workSearchUrl(workId: string): URL {
  const url = new URL(`${SITE}/search.json`);
  url.searchParams.set("q", `key:/works/${workId}`);
  url.searchParams.set("fields", SEARCH_FIELDS);
  url.searchParams.set("limit", "1");
  return url;
}

export const workUrl = (workId: string): URL => new URL(`${SITE}/works/${workId}.json`);

const coverFor = (coverId: unknown): string | null => {
  const id = num(coverId);
  return id && id > 0 ? `${COVERS}/${Math.floor(id)}-M.jpg` : null;
};

/** One search result as a book in a list, or null (no usable id or title, or filed as erotica). */
export function shapeOpenLibrarySummary(doc: unknown): BookSummary | null {
  const raw = obj(doc);
  const workId = str(raw.key, 60)?.match(/^\/works\/(OL\d{1,12}W)$/)?.[1];
  const title = str(raw.title, 300);
  if (!workId || !title) return null;
  const subjects = strings(raw.subject, 40);
  if (subjects.some((s) => MATURE_SUBJECT.test(s))) return null;
  const year = num(raw.first_publish_year);
  return {
    id: `ol-${workId}`,
    title,
    authors: strings(raw.author_name),
    cover: coverFor(raw.cover_i),
    publishedYear: year ? String(year) : null,
    categories: subjects.slice(0, 5),
    pageCount: num(raw.number_of_pages_median),
    source: "openlibrary",
  };
}

export function shapeOpenLibraryPage(body: unknown, page: number): BookPage {
  const raw = obj(body);
  const totalItems = num(raw.numFound) ?? 0;
  const docs = Array.isArray(raw.docs) ? raw.docs : [];
  const items: BookSummary[] = [];
  const seen = new Set<string>();
  for (const doc of docs) {
    const book = shapeOpenLibrarySummary(doc);
    if (book && !seen.has(book.id)) {
      seen.add(book.id);
      items.push(book);
    }
  }
  // Same end rule as Google's lists: a short page, or past the total, or 20 pages in.
  const hasMore = docs.length === PAGE_SIZE && (page + 1) * PAGE_SIZE < totalItems && page < 19;
  return { items, page, pageSize: PAGE_SIZE, hasMore, totalItems };
}

/** A work's details, from its search entry (authors, year, pages, publisher) and its own record (description). */
export function shapeOpenLibraryDetail(searchBody: unknown, work: unknown): BookDetail {
  const doc = (obj(searchBody).docs as unknown[] | undefined)?.[0];
  const summary = shapeOpenLibrarySummary(doc);
  const w = obj(work);
  // A work filed as erotica still opens for a grown-up, marked mature so Teen profiles don't see it.
  const fallbackSummary = summary ?? shapeOpenLibrarySummary({ ...obj(doc), subject: [] });
  if (!fallbackSummary) throw new HttpError("not_found", "We couldn't find that book.");
  const rawDescription = typeof w.description === "string" ? w.description : str(obj(w.description).value, 20000);
  const description = rawDescription ? rawDescription.replace(/\r\n/g, "\n").trim().slice(0, 8000) : null;
  // The search entry lists every edition's language (a classic can list a dozen), so a language is
  // given only when all its editions share one; otherwise the page doesn't name one.
  const languages = strings(obj(doc).language, 50);
  const language = languages.length === 1 ? languages[0] : undefined;
  const workId = fallbackSummary.id.slice(3);
  return {
    ...fallbackSummary,
    subtitle: str(w.subtitle, 300),
    description,
    publisher: strings(obj(doc).publisher, 1)[0] ?? null,
    publishedDate: fallbackSummary.publishedYear,
    language: language ? (LANGUAGES[language] ?? null) : null,
    averageRating: null,
    ratingsCount: null,
    previewLink: `${SITE}/works/${workId}`,
    preview: null,
    mature: !summary,
  };
}

/** Asks Open Library, with the app's name and contact, an 8-second budget and no retries. */
export async function callOpenLibrary(url: URL, fetcher: typeof fetch = fetch): Promise<unknown> {
  let res: Response;
  try {
    res = await fetcher(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
  } catch {
    throw new HttpError("upstream_error", "We couldn't reach the book service. Try again.");
  }
  if (res.status === 404) {
    await res.body?.cancel();
    throw new HttpError("not_found", "We couldn't find that book.");
  }
  if (!res.ok) {
    await res.body?.cancel();
    console.warn("open library error", res.status);
    throw new HttpError("upstream_error", "The book service had a problem. Try again.");
  }
  try {
    return await res.json();
  } catch {
    throw new HttpError("upstream_error", "The book service sent something we couldn't read.");
  }
}

/** One genre page from Open Library. */
export async function openLibraryGenrePage(genre: Genre, page: number, fetcher: typeof fetch = fetch): Promise<BookPage> {
  return shapeOpenLibraryPage(await callOpenLibrary(subjectUrl(genre, page), fetcher), page);
}

/** A work's details by its app id (`ol-OL…W`). */
export async function openLibraryDetail(id: string, fetcher: typeof fetch = fetch): Promise<BookDetail> {
  const workId = id.slice(3);
  const [search, work] = await Promise.all([callOpenLibrary(workSearchUrl(workId), fetcher), callOpenLibrary(workUrl(workId), fetcher)]);
  if (!Array.isArray(obj(search).docs) || !(obj(search).docs as unknown[]).length) throw new HttpError("not_found", "We couldn't find that book.");
  return shapeOpenLibraryDetail(search, work);
}
