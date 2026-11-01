import { CATALOG } from "../_shared/catalog.ts";
import { bookChapters } from "../_shared/bookText.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { translatePassage } from "./claude.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    book: (id) => {
      const book = CATALOG[id];
      return book?.publicDomain ? { title: book.title, author: book.author } : null;
    },
    chapters: bookChapters,
    translate: translatePassage,
    // Each translation is a Claude call: 30 an hour per IP, and 1,000 a day for everyone.
    rateLimit: async (r) => {
      await enforceRateLimit(`translate:${clientIp(r)}`, 30, 3600);
      await enforceRateLimit("translate:all", 1000, 86400);
    },
  })
);
