// The tools LiteraryWorm offers over MCP. Every one only reads. The public ones (the catalog,
// pricing, What's new) need no log-in; the member ones read the connected member's own library,
// places, highlights and reading time, never a Kids profile's reading time, and change nothing.

import { CATALOG } from "../_shared/catalog.ts";

export const SITE = "https://www.literaryworm.com";

export type PlanRow = {
  id: string;
  name: string;
  priceCents: number;
  yearlyPriceCents: number | null;
  currency: string;
  maxProfiles: number;
  audioHours: number | null;
  downloadDevices: number;
  summary: string;
};

export type ChangelogRow = { releasedOn: string; kind: string; title: string; body: string; major: boolean };

export type LibraryRow = {
  id: string;
  /** Null for a book whose details aren't kept (a Google Books title we may not keep a copy of). */
  title: string | null;
  author: string | null;
  source: "literaryworm" | "upload" | "google_books" | "open_library";
  status: string;
  addedAt: string;
  progress: { format: string; percent: number; finished: boolean; updatedAt: string } | null;
};

export type HighlightRow = { bookId: string; chapter: number; quote: string; note: string | null; color: string; createdAt: string };

export type ProfileStats = { profile: string; minutes: number; listeningMinutes: number; daysRead: number; booksFinished: number };

/** Where the tools read from: the database in production, stand-ins in tests. */
export type Data = {
  plans: () => Promise<PlanRow[]>;
  whatsNew: (limit: number) => Promise<ChangelogRow[]>;
  library: (userId: string) => Promise<LibraryRow[]>;
  highlights: (userId: string, bookId: string | null, limit: number) => Promise<HighlightRow[]>;
  /** Reading time per profile from `since` (a day, YYYY-MM-DD) on. Kids profiles are never included. */
  stats: (userId: string, since: string) => Promise<ProfileStats[]>;
  /**
   * The ids of books a Kids profile in this household has spent reading or listening time in. The
   * library and highlights are the whole household's, so these books are left out of both: what a
   * child reads isn't passed to a connected app.
   */
  kidsBooks: (userId: string) => Promise<string[]>;
};

type Schema = { type: "object"; properties: Record<string, Record<string, unknown>>; required?: string[]; additionalProperties: false };

export type Tool = { name: string; title: string; description: string; inputSchema: Schema; member: boolean };

const STATUSES = ["want_to_read", "reading", "finished", "did_not_finish"] as const;
const BOOK_ID = /^[A-Za-z0-9_-]{1,40}$/;

export const SEARCH_LIMIT_MAX = 25;
export const HIGHLIGHTS_LIMIT_MAX = 200;
export const STATS_DAYS_MAX = 366;

export const TOOLS: Tool[] = [
  {
    name: "search_catalog",
    title: "Search LiteraryWorm's catalog",
    description:
      "Finds books in LiteraryWorm's own catalog by words in the title, author or description. Returns each book's id, title, author, year and page on literaryworm.com. Members can also read and listen to Google Books and Open Library titles on the site; those aren't searched here.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, maxLength: 100, description: "Words to look for, such as a title or an author's name." },
        limit: { type: "integer", minimum: 1, maximum: SEARCH_LIMIT_MAX, description: "How many books to return (10 unless given)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    member: false,
  },
  {
    name: "get_book",
    title: "A catalog book's details",
    description: "One LiteraryWorm catalog book by its id (from search_catalog or get_library): title, author, year, description, and whether the full text and audiobook are included (public-domain classics) or a sample.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", pattern: "^[A-Za-z0-9_-]{1,40}$", description: "The book's id, such as pride-and-prejudice." } },
      required: ["id"],
      additionalProperties: false,
    },
    member: false,
  },
  {
    name: "get_pricing",
    title: "Plans and prices",
    description: "LiteraryWorm's membership plans: monthly and yearly prices, profiles, audiobook hours a month and offline devices.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    member: false,
  },
  {
    name: "whats_new",
    title: "What's new",
    description: "The latest entries from LiteraryWorm's What's new page: new features, updates and fixes, newest first.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 20, description: "How many entries to return (5 unless given)." } },
      additionalProperties: false,
    },
    member: false,
  },
  {
    name: "get_library",
    title: "My library",
    description:
      "The connected member's library: each book's status (want_to_read, reading, finished, did_not_finish), when it was added, and how far through it they are. Books read on a Kids profile are left out. Read-only.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", enum: [...STATUSES], description: "Only books with this status." } },
      additionalProperties: false,
    },
    member: true,
  },
  {
    name: "get_highlights",
    title: "My highlights and notes",
    description: "The connected member's highlighted passages and the notes on them, newest first, for one book or all of them. Books read on a Kids profile are left out. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        book_id: { type: "string", pattern: "^[A-Za-z0-9_-]{1,40}$", description: "Only this book's highlights (an id from get_library)." },
        limit: { type: "integer", minimum: 1, maximum: HIGHLIGHTS_LIMIT_MAX, description: "How many to return (50 unless given)." },
      },
      additionalProperties: false,
    },
    member: true,
  },
  {
    name: "get_reading_stats",
    title: "My reading time",
    description:
      "Minutes read and listened, days read and books finished over the last days, for each grown-up and teen profile in the connected member's household. Kids profiles are never included. Read-only.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "integer", minimum: 1, maximum: STATS_DAYS_MAX, description: "How many days back to count, today included (30 unless given)." } },
      additionalProperties: false,
    },
    member: true,
  },
];

/** A tool call that can't be answered as asked; told to the model as a tool error, not a protocol one. */
export class ToolError extends Error {}

const bookUrl = (id: string) => `${SITE}/books/${id}`;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Catalog books with every word of the query in the title, author or description: title matches first, then author. */
export function searchCatalog(query: string, limit: number) {
  const words = fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (words.length === 0) return [];
  const found: { score: number; year: number; id: string }[] = [];
  for (const [id, book] of Object.entries(CATALOG)) {
    const title = fold(book.title);
    const author = fold(book.author);
    const all = `${title} ${author} ${fold(book.synopsis)}`;
    if (!words.every((w) => all.includes(w))) continue;
    const score = words.reduce((sum, w) => sum + (title.includes(w) ? 3 : author.includes(w) ? 2 : 1), 0);
    found.push({ score, year: book.year, id });
  }
  found.sort((a, b) => b.score - a.score || CATALOG[a.id].title.localeCompare(CATALOG[b.id].title));
  return found.slice(0, limit).map(({ id }) => {
    const book = CATALOG[id];
    return { id, title: book.title, author: book.author, year: book.year, url: bookUrl(id) };
  });
}

function onlyArgs(args: Record<string, unknown>, tool: Tool): void {
  for (const key of Object.keys(args)) {
    if (!(key in tool.inputSchema.properties)) throw new ToolError(`${tool.name} doesn't take "${key}".`);
  }
  for (const key of tool.inputSchema.required ?? []) {
    if (args[key] === undefined) throw new ToolError(`${tool.name} needs "${key}".`);
  }
}

function wholeNumber(raw: unknown, name: string, min: number, max: number, fallback: number): number {
  if (raw === undefined) return fallback;
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < min || raw > max) throw new ToolError(`${name} must be a whole number from ${min} to ${max}.`);
  return raw;
}

function bookId(raw: unknown, name: string): string {
  if (typeof raw !== "string" || !BOOK_ID.test(raw)) throw new ToolError(`${name} isn't a valid book id.`);
  return raw;
}

const money = (cents: number, currency: string) => `${(cents / 100).toFixed(2)} ${currency.trim()}`;

/** The day `days` days back from `now`, today counting as the first, in UTC (YYYY-MM-DD). */
export function sinceDay(now: Date, days: number): string {
  return new Date(now.getTime() - (days - 1) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Runs one tool. `userId` is the connected member, or null on the public endpoint, where member
 * tools aren't listed and can't be called.
 */
export async function callTool(name: string, args: Record<string, unknown>, userId: string | null, data: Data, now: Date = new Date()): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool || (tool.member && !userId)) throw new ToolError(`There's no tool called ${name} here.`);
  onlyArgs(args, tool);

  switch (tool.name) {
    case "search_catalog": {
      if (typeof args.query !== "string" || args.query.trim().length < 1 || args.query.length > 100) throw new ToolError("query must be 1 to 100 characters.");
      const books = searchCatalog(args.query, wholeNumber(args.limit, "limit", 1, SEARCH_LIMIT_MAX, 10));
      return { count: books.length, books };
    }
    case "get_book": {
      const id = bookId(args.id, "id");
      const book = CATALOG[id];
      if (!book) throw new ToolError("That id isn't a LiteraryWorm catalog book. Use search_catalog to find one.");
      return {
        id,
        title: book.title,
        author: book.author,
        year: book.year,
        description: book.synopsis,
        included: book.publicDomain ? "The full text and an audiobook recording, for members." : "A sample, for members.",
        url: bookUrl(id),
      };
    }
    case "get_pricing": {
      const plans = await data.plans();
      return {
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          monthly: money(p.priceCents, p.currency),
          yearly: p.yearlyPriceCents ? money(p.yearlyPriceCents, p.currency) : null,
          profiles: p.maxProfiles,
          audiobookHoursAMonth: p.audioHours ?? "unlimited",
          offlineDevices: p.downloadDevices,
          summary: p.summary,
        })),
        note: "A first membership starts with 7 days free. Billed through Stripe until cancelled.",
        url: `${SITE}/pricing`,
      };
    }
    case "whats_new": {
      const entries = await data.whatsNew(wholeNumber(args.limit, "limit", 1, 20, 5));
      return { entries, url: `${SITE}/whats-new` };
    }
    case "get_library": {
      const status = args.status;
      if (status !== undefined && !(STATUSES as readonly unknown[]).includes(status)) throw new ToolError(`status must be one of ${STATUSES.join(", ")}.`);
      const kids = new Set(await data.kidsBooks(userId!));
      const rows = (await data.library(userId!)).filter((r) => !kids.has(r.id) && (status === undefined || r.status === status));
      return {
        count: rows.length,
        books: rows.map((r) => ({ ...r, url: r.source === "upload" ? null : bookUrl(r.id) })),
      };
    }
    case "get_highlights": {
      const only = args.book_id === undefined ? null : bookId(args.book_id, "book_id");
      const limit = wholeNumber(args.limit, "limit", 1, HIGHLIGHTS_LIMIT_MAX, 50);
      const kids = new Set(await data.kidsBooks(userId!));
      const rows = only !== null && kids.has(only) ? [] : (await data.highlights(userId!, only, limit)).filter((h) => !kids.has(h.bookId));
      return {
        count: rows.length,
        highlights: rows.map((h) => ({ ...h, bookTitle: CATALOG[h.bookId]?.title ?? null })),
      };
    }
    case "get_reading_stats": {
      const days = wholeNumber(args.days, "days", 1, STATS_DAYS_MAX, 30);
      const since = sinceDay(now, days);
      const profiles = await data.stats(userId!, since);
      const sum = (pick: (p: ProfileStats) => number) => profiles.reduce((n, p) => n + pick(p), 0);
      return {
        since,
        days,
        profiles,
        household: { minutes: sum((p) => p.minutes), listeningMinutes: sum((p) => p.listeningMinutes), booksFinished: sum((p) => p.booksFinished) },
        note: "Minutes include listening. Kids profiles aren't included.",
      };
    }
  }
  throw new ToolError(`There's no tool called ${name} here.`);
}
