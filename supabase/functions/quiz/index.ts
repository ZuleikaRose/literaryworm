import { bookChapters } from "../_shared/bookText.ts";
import { CATALOG } from "../_shared/catalog.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { writeQuiz } from "./claude.ts";
import { handle, type Question } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    book: (id) => {
      const book = CATALOG[id];
      return book?.publicDomain ? { title: book.title, author: book.author } : null;
    },
    chapters: bookChapters,
    async cached(id, chapter) {
      const { data, error } = await serviceClient()
        .from("chapter_quizzes")
        .select("questions")
        .eq("volume_id", id)
        .eq("chapter_index", chapter)
        .maybeSingle();
      if (error) throw error;
      return (data?.questions as Question[] | undefined) ?? null;
    },
    async keep(id, chapter, questions, model) {
      const db = serviceClient();
      const { error } = await db
        .from("chapter_quizzes")
        .upsert({ volume_id: id, chapter_index: chapter, questions, model }, { onConflict: "volume_id,chapter_index", ignoreDuplicates: true });
      if (error) throw error;
      // Read back what's kept: another reader's quiz may have been saved first.
      const { data, error: readError } = await db.from("chapter_quizzes").select("questions").eq("volume_id", id).eq("chapter_index", chapter).single();
      if (readError) throw readError;
      return data.questions as Question[];
    },
    write: writeQuiz,
    // Only a new quiz is a Claude call (kept quizzes are free): 10 an hour per IP, and 300 a day for everyone.
    rateLimit: async (r) => {
      await enforceRateLimit(`quiz:${clientIp(r)}`, 10, 3600);
      await enforceRateLimit("quiz:all", 300, 86400);
    },
  })
);
