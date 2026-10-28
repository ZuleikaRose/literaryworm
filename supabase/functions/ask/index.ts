import { CATALOG } from "../_shared/catalog.ts";
import { HttpError, clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { answerQuestion } from "./claude.ts";
import { handle } from "./handler.ts";

// The reader's texts are static files on the website (public/texts, built from Project
// Gutenberg). TEXTS_ORIGIN can point elsewhere, e.g. a preview deploy.
const TEXTS_ORIGIN = (Deno.env.get("TEXTS_ORIGIN") ?? "https://www.literaryworm.com").replace(/\/$/, "");

// Kept between requests while the function instance is warm.
const texts = new Map<string, Promise<string[]>>();

async function download(id: string): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${TEXTS_ORIGIN}/texts/${encodeURIComponent(id)}.json`, { signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new HttpError("upstream_error", "We couldn't load this book's text. Try again.");
  }
  if (!res.ok) {
    await res.body?.cancel();
    throw new HttpError("upstream_error", "We couldn't load this book's text. Try again.");
  }
  const body = (await res.json().catch(() => null)) as { chapters?: unknown } | null;
  const chapters = body?.chapters;
  if (!Array.isArray(chapters) || !chapters.every((c) => typeof c === "string")) {
    throw new HttpError("upstream_error", "We couldn't read this book's text. Try again later.");
  }
  return chapters as string[];
}

function chapters(id: string): Promise<string[]> {
  let pending = texts.get(id);
  if (!pending) {
    pending = download(id);
    texts.set(id, pending);
    pending.catch(() => texts.delete(id));
  }
  return pending;
}

Deno.serve((req) =>
  handle(req, {
    book: (id) => {
      const book = CATALOG[id];
      return book?.publicDomain ? { title: book.title, author: book.author } : null;
    },
    chapters,
    answer: answerQuestion,
    // Each question is a Claude call: 20 an hour per IP, and 500 a day for everyone.
    rateLimit: async (r) => {
      await enforceRateLimit(`ask:${clientIp(r)}`, 20, 3600);
      await enforceRateLimit("ask:all", 500, 86400);
    },
  })
);
