import { bookChapters } from "../_shared/bookText.ts";
import { CATALOG } from "../_shared/catalog.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { writeCharacters } from "./claude.ts";
import { type Character, handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    book: (id) => {
      const book = CATALOG[id];
      return book?.publicDomain ? { title: book.title, author: book.author } : null;
    },
    chapters: bookChapters,
    async cached(id, chapter) {
      const { data, error } = await serviceClient()
        .from("book_characters")
        .select("characters")
        .eq("volume_id", id)
        .eq("chapter_index", chapter)
        .maybeSingle();
      if (error) throw error;
      return (data?.characters as Character[] | undefined) ?? null;
    },
    async keep(id, chapter, characters, model) {
      const db = serviceClient();
      const { error } = await db
        .from("book_characters")
        .upsert({ volume_id: id, chapter_index: chapter, characters, model }, { onConflict: "volume_id,chapter_index", ignoreDuplicates: true });
      if (error) throw error;
      // Read back what's kept: another reader's list may have been saved first.
      const { data, error: readError } = await db.from("book_characters").select("characters").eq("volume_id", id).eq("chapter_index", chapter).single();
      if (readError) throw readError;
      return data.characters as Character[];
    },
    write: writeCharacters,
    // Only a new list is a Claude call (kept lists are free): 10 an hour per IP, and 300 a day for everyone.
    rateLimit: async (r) => {
      await enforceRateLimit(`characters:${clientIp(r)}`, 10, 3600);
      await enforceRateLimit("characters:all", 300, 86400);
    },
  })
);
