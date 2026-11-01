import { CATALOG } from "../_shared/catalog.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { writeNotes } from "./claude.ts";
import { type ContentNotes, handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    getCached: async (id) => {
      const { data, error } = await serviceClient().from("book_content_notes").select("overall, notes").eq("volume_id", id).maybeSingle();
      if (error) throw error;
      return data ? ({ overall: data.overall, notes: data.notes } as ContentNotes) : null;
    },
    describe: (id) => {
      const book = CATALOG[id];
      return book ? { id, title: book.title, author: book.author, year: book.year, synopsis: book.synopsis, publicDomain: book.publicDomain } : null;
    },
    write: writeNotes,
    store: async (id, notes, model) => {
      // Two first readers at once both write; the first one kept wins.
      const { error } = await serviceClient().from("book_content_notes").upsert(
        { volume_id: id, overall: notes.overall, notes: notes.notes, model },
        { onConflict: "volume_id", ignoreDuplicates: true },
      );
      if (error) console.error("content-notes: couldn't keep the notes", error.message);
    },
    // Reading kept notes: 60 a minute per IP.
    rateLimit: (r) => enforceRateLimit(`content-notes:${clientIp(r)}`, 60, 60),
    // Writing new ones costs a Claude call: 10 an hour per IP, and 300 a day for everyone.
    writeLimit: async (r) => {
      await enforceRateLimit(`content-notes-write:${clientIp(r)}`, 10, 3600);
      await enforceRateLimit("content-notes-write:all", 300, 86400);
    },
  })
);
