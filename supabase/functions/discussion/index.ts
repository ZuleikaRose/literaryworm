import { bookChapters } from "../_shared/bookText.ts";
import { CATALOG } from "../_shared/catalog.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { writeQuestions } from "./claude.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    book: (id) => {
      const book = CATALOG[id];
      return book?.publicDomain ? { title: book.title, author: book.author } : null;
    },
    chapters: bookChapters,
    async cached(id, chapter) {
      const { data, error } = await serviceClient()
        .from("chapter_discussions")
        .select("questions")
        .eq("volume_id", id)
        .eq("chapter_index", chapter)
        .maybeSingle();
      if (error) throw error;
      return data ? (data.questions as string[]) : null;
    },
    async keep(id, chapter, questions, model) {
      const db = serviceClient();
      const { error } = await db
        .from("chapter_discussions")
        .upsert({ volume_id: id, chapter_index: chapter, questions, model }, { onConflict: "volume_id,chapter_index", ignoreDuplicates: true });
      if (error) throw error;
      // Read back what's kept: another club's questions may have been saved first.
      const { data, error: readError } = await db.from("chapter_discussions").select("questions").eq("volume_id", id).eq("chapter_index", chapter).single();
      if (readError) throw readError;
      return data.questions as string[];
    },
    write: writeQuestions,
    // Only new questions are a Claude call (kept ones are free): 10 an hour per IP, and 300 a day for everyone.
    rateLimit: async (r) => {
      await enforceRateLimit(`discussion:${clientIp(r)}`, 10, 3600);
      await enforceRateLimit("discussion:all", 300, 86400);
    },
  })
);
