import { CATALOG } from "../_shared/catalog.ts";
import { callGoogle, shapeDetail, volumeUrl } from "../_shared/googleBooks.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { writeSummaries } from "./claude.ts";
import { type BookFacts, handle } from "./handler.ts";

async function describe(id: string): Promise<BookFacts> {
  const book = CATALOG[id];
  if (book) {
    return {
      id,
      title: book.title,
      authors: [book.author],
      year: String(book.year),
      categories: [],
      description: book.synopsis,
      publicDomain: book.publicDomain,
    };
  }
  // Any other id is a Google Books volume (callGoogle turns a 404 into not_found).
  const detail = shapeDetail(await callGoogle(volumeUrl(id, Deno.env.get("GOOGLE_BOOKS_API_KEY"))));
  return {
    id,
    title: detail.title,
    authors: detail.authors,
    year: detail.publishedYear,
    categories: detail.categories,
    description: detail.description,
    publicDomain: false,
  };
}

Deno.serve((req) =>
  handle(req, {
    getCached: async (id) => {
      const { data, error } = await serviceClient()
        .from("book_summaries")
        .select("short_summary, detailed_summary")
        .eq("volume_id", id)
        .maybeSingle();
      if (error) throw error;
      return data ? { short: data.short_summary, detailed: data.detailed_summary } : null;
    },
    describe,
    write: writeSummaries,
    store: async (id, summaries, model) => {
      // Two first readers at once both write; the first one kept wins.
      const { error } = await serviceClient().from("book_summaries").upsert(
        { volume_id: id, short_summary: summaries.short, detailed_summary: summaries.detailed, model },
        { onConflict: "volume_id", ignoreDuplicates: true },
      );
      if (error) console.error("summaries: couldn't keep the summary", error.message);
    },
    // Reading a kept summary: 60 a minute per IP.
    rateLimit: (r) => enforceRateLimit(`summaries:${clientIp(r)}`, 60, 60),
    // Writing a new one costs a Claude call: 10 an hour per IP, and 300 a day for everyone.
    writeLimit: async (r) => {
      await enforceRateLimit(`summaries-write:${clientIp(r)}`, 10, 3600);
      await enforceRateLimit("summaries-write:all", 300, 86400);
    },
  })
);
