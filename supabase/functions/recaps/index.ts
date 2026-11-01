import { bookChapters } from "../_shared/bookText.ts";
import { CATALOG } from "../_shared/catalog.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { writeRecap } from "./claude.ts";
import { handle, type Recap } from "./handler.ts";

type Row = { so_far: string; last_chapter: string };
const toRecap = (row: Row): Recap => ({ soFar: row.so_far, lastChapter: row.last_chapter });

Deno.serve((req) =>
  handle(req, {
    book: (id) => {
      const book = CATALOG[id];
      return book?.publicDomain ? { title: book.title, author: book.author } : null;
    },
    chapters: bookChapters,
    async cached(id, chapter) {
      const { data, error } = await serviceClient()
        .from("chapter_recaps")
        .select("so_far, last_chapter")
        .eq("volume_id", id)
        .eq("chapter_index", chapter)
        .maybeSingle();
      if (error) throw error;
      return data ? toRecap(data as Row) : null;
    },
    async keep(id, chapter, recap, model) {
      const db = serviceClient();
      const { error } = await db
        .from("chapter_recaps")
        .upsert(
          { volume_id: id, chapter_index: chapter, so_far: recap.soFar, last_chapter: recap.lastChapter, model },
          { onConflict: "volume_id,chapter_index", ignoreDuplicates: true },
        );
      if (error) throw error;
      // Read back what's kept: another listener's recap may have been saved first.
      const { data, error: readError } = await db.from("chapter_recaps").select("so_far, last_chapter").eq("volume_id", id).eq("chapter_index", chapter).single();
      if (readError) throw readError;
      return toRecap(data as Row);
    },
    write: writeRecap,
    // Only a new recap is a Claude call (kept ones are free): 10 an hour per IP, and 300 a day for everyone.
    rateLimit: async (r) => {
      await enforceRateLimit(`recaps:${clientIp(r)}`, 10, 3600);
      await enforceRateLimit("recaps:all", 300, 86400);
    },
  })
);
