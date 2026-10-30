import { CATALOG } from "../_shared/catalog.ts";
import { bookChapters } from "../_shared/bookText.ts";
import { clientIp } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { answerQuestion } from "./claude.ts";
import { handle } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    book: (id) => {
      const book = CATALOG[id];
      return book?.publicDomain ? { title: book.title, author: book.author } : null;
    },
    chapters: bookChapters,
    answer: answerQuestion,
    // Each question is a Claude call: 20 an hour per IP, and 500 a day for everyone.
    rateLimit: async (r) => {
      await enforceRateLimit(`ask:${clientIp(r)}`, 20, 3600);
      await enforceRateLimit("ask:all", 500, 86400);
    },
  })
);
