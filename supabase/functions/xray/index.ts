import { bookChapters } from "../_shared/bookText.ts";
import { chapterCount } from "../_shared/chapterCounts.ts";
import { CATALOG } from "../_shared/catalog.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { writeXRay } from "./claude.ts";
import { handle, type XRay } from "./handler.ts";

const COLUMNS = "people, places, terms";
const asXRay = (row: { people: unknown; places: unknown; terms: unknown }): XRay => ({
  people: row.people as XRay["people"],
  places: row.places as XRay["places"],
  terms: row.terms as XRay["terms"],
});

Deno.serve((req) =>
  handle(req, {
    book: (id) => {
      const book = CATALOG[id];
      return book?.publicDomain ? { title: book.title, author: book.author } : null;
    },
    chapterCount,
    chapters: bookChapters,
    async cached(id, chapter) {
      const { data, error } = await serviceClient().from("book_xray").select(COLUMNS).eq("volume_id", id).eq("chapter_index", chapter).maybeSingle();
      if (error) throw error;
      return data ? asXRay(data) : null;
    },
    async keep(id, chapter, xray, model) {
      const db = serviceClient();
      const { error } = await db
        .from("book_xray")
        .upsert({ volume_id: id, chapter_index: chapter, ...xray, model }, { onConflict: "volume_id,chapter_index", ignoreDuplicates: true });
      if (error) throw error;
      // Read back what's kept: another reader's X-Ray may have been saved first.
      const { data, error: readError } = await db.from("book_xray").select(COLUMNS).eq("volume_id", id).eq("chapter_index", chapter).single();
      if (readError) throw readError;
      return asXRay(data);
    },
    write: writeXRay,
    // Only a new X-Ray is a Claude call (kept ones are free): 10 an hour per IP, and 300 a day for everyone.
    rateLimit: async (r) => {
      await enforceRateLimit(`xray:${clientIp(r)}`, 10, 3600);
      await enforceRateLimit("xray:all", 300, 86400);
    },
  })
);
