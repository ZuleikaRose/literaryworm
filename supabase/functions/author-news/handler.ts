// POST /functions/v1/author-news — called by pg_cron (private.call_author_news), never by the
// browser.
//
//   { task: "check" }  daily: asks Google Books for the newest titles of up to 100 followed
//                      authors not checked in the last six days, and records the ones out in
//                      the last 30 days for every (non-Kids) profile that follows them
//   { task: "email" }  Mondays: emails each account the new books found since its last email
//
// The caller must send the secret kept in Vault (Authorization: Bearer …); anything else is
// refused. Emails are claimed first (marked emailed, so two runs can't send the same book);
// an account whose email Mailgun refuses gets its books handed back for the next run.

import { authorNewsEmail, type Email, type NewBook } from "./email.ts";

/** A book worth telling followers about, checked and trimmed for record_author_news(). */
export interface FoundBook {
  id: string;
  title: string;
  published: string;
}

export interface Deps {
  /** The secret from Vault; null when it's missing (then nothing runs). */
  secret: () => Promise<string | null>;
  authorsToCheck: (max: number) => Promise<string[]>;
  /** Google Books' answer for the author's newest titles (the raw JSON). */
  searchAuthor: (name: string) => Promise<unknown>;
  /** Records the author as checked and their new books for followers; returns rows added. */
  record: (name: string, books: FoundBook[]) => Promise<number>;
  claim: (max: number) => Promise<NewBook[]>;
  /** Marks these books as not emailed again, for the next run. */
  release: (books: NewBook[]) => Promise<void>;
  send: (email: Email) => Promise<void>;
  siteOrigin: string;
  now?: () => Date;
}

/** Authors checked in one run; the rest wait a day. */
export const AUTHORS_PER_RUN = 100;
/** Books emailed in one run. */
export const EMAIL_BATCH = 500;
/** How recent a book must be to count as new. */
export const NEW_DAYS = 30;
/** At most this many books per author per check (Google lists editions separately). */
export const BOOKS_PER_AUTHOR = 5;
/** A run stops asking Google after this many failures in a row (quota or an outage). */
const MAX_FAILURES = 3;

const VOLUME_ID = /^[A-Za-z0-9_-]{1,40}$/;
const DATE = /^(\d{4})-(\d{2})(?:-(\d{2}))?/;
const DAY_MS = 86_400_000;

const encoder = new TextEncoder();

/** Compares in time that doesn't depend on where the strings differ. */
export function sameSecret(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const fold = (s: string) => s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The books in Google's answer that are by `author` (an exact name match: Google's inauthor:
 * also matches other people with the same words in their name) and came out in the last
 * NEW_DAYS days, newest first, one edition per title. A date with only a year is too vague
 * to call new; a month counts from its first day.
 */
export function newBooks(body: unknown, author: string, now: Date): FoundBook[] {
  const items = obj(body).items;
  if (!Array.isArray(items)) return [];
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const seen = new Set<string>();
  const found: (FoundBook & { time: number })[] = [];
  for (const item of items) {
    const id = obj(item).id;
    const info = obj(obj(item).volumeInfo);
    const title = typeof info.title === "string" ? info.title.replace(/\s+/g, " ").trim().slice(0, 300) : "";
    const authors = Array.isArray(info.authors) ? info.authors.filter((a): a is string => typeof a === "string") : [];
    const date = typeof info.publishedDate === "string" ? DATE.exec(info.publishedDate) : null;
    if (typeof id !== "string" || !VOLUME_ID.test(id) || !title || !date) continue;
    if (!authors.some((a) => fold(a) === fold(author))) continue;
    const time = Date.UTC(Number(date[1]), Number(date[2]) - 1, Number(date[3] ?? 1));
    if (Number.isNaN(time) || time > today || time < today - NEW_DAYS * DAY_MS) continue;
    const key = fold(title);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ id, title, published: date[3] ? `${date[1]}-${date[2]}-${date[3]}` : `${date[1]}-${date[2]}`, time });
  }
  return found
    .sort((a, b) => b.time - a.time)
    .slice(0, BOOKS_PER_AUTHOR)
    .map(({ id, title, published }) => ({ id, title, published }));
}

function byAccount(books: NewBook[]): NewBook[][] {
  const groups = new Map<string, NewBook[]>();
  for (const b of books) groups.set(b.userId, [...(groups.get(b.userId) ?? []), b]);
  return [...groups.values()];
}

const reply = (status: number, body: unknown) => Response.json(body, { status });

async function check(deps: Deps, now: Date) {
  const names = await deps.authorsToCheck(AUTHORS_PER_RUN);
  let checked = 0;
  let added = 0;
  let failures = 0;
  for (const name of names) {
    try {
      const books = newBooks(await deps.searchAuthor(name), name, now);
      added += await deps.record(name, books);
      checked += 1;
      failures = 0;
    } catch (err) {
      // Not recorded as checked, so the author is asked about again on the next run.
      console.error("author-news: checking an author failed", err);
      if (++failures >= MAX_FAILURES) break;
    }
  }
  return { authors: names.length, checked, added };
}

async function email(deps: Deps) {
  const due = await deps.claim(EMAIL_BATCH);
  let sent = 0;
  let failed = 0;
  for (const books of byAccount(due)) {
    try {
      await deps.send(authorNewsEmail(books, deps.siteOrigin));
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`author-news: sending to account ${books[0].userId} failed`, err);
      // If even this fails, the books stay in the bell; only their email is lost.
      await deps.release(books).catch((e) => console.error(`author-news: handing back account ${books[0].userId}'s books failed`, e));
    }
  }
  return { accounts: sent + failed, sent, failed };
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];

  try {
    const secret = await deps.secret();
    if (!secret || !given || !sameSecret(given, secret)) {
      return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
    }
    const body = obj(await req.json().catch(() => null));
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== "task" || (body.task !== "check" && body.task !== "email")) {
      return reply(400, { error: { code: "bad_request", message: 'Send { "task": "check" } or { "task": "email" }.' } });
    }
    const now = deps.now?.() ?? new Date();
    return reply(200, body.task === "check" ? await check(deps, now) : await email(deps));
  } catch (err) {
    console.error("author-news: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
