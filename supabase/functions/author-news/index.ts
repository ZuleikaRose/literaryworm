// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Google Books is asked with the GOOGLE_BOOKS_API_KEY function setting; emails go through
// Mailgun's API (_shared/mailgun.ts). Nothing is hard-coded.
import { authorQuery, callGoogle, listUrl } from "../_shared/googleBooks.ts";
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import type { NewBook } from "./email.ts";
import { handle } from "./handler.ts";

interface ClaimedRow {
  user_id: string;
  email: string;
  account_name: string | null;
  profile_id: string;
  profile_name: string | null;
  volume_id: string;
  title: string;
  author: string;
  published: string;
}

const site = publicSiteOrigin();
const key = Deno.env.get("GOOGLE_BOOKS_API_KEY");

Deno.serve((req) =>
  handle(req, {
    async secret() {
      const { data, error } = await serviceClient().rpc("author_news_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async authorsToCheck(max) {
      const { data, error } = await serviceClient().rpc("authors_to_check", { max_count: max });
      if (error) throw error;
      return (data as { name: string }[]).map((r) => r.name);
    },
    // Newest first, the first page only: a new book is near the top. Google sees the name,
    // never who follows it.
    searchAuthor: (name) => callGoogle(listUrl(authorQuery(name), 0, key, "newest")),
    async record(name, books) {
      const { data, error } = await serviceClient().rpc("record_author_news", { p_name: name, p_books: books });
      if (error) throw error;
      return Number(data) || 0;
    },
    async claim(max) {
      const { data, error } = await serviceClient().rpc("claim_author_emails", { max_count: max });
      if (error) throw error;
      return (data as ClaimedRow[]).map(
        (r): NewBook => ({
          userId: r.user_id,
          email: r.email,
          accountName: r.account_name,
          profileId: r.profile_id,
          profileName: r.profile_name,
          volumeId: r.volume_id,
          title: r.title,
          author: r.author,
          published: r.published,
        }),
      );
    },
    async release(books) {
      const db = serviceClient();
      for (const b of books) {
        const { error } = await db
          .from("author_news")
          .update({ emailed_at: null })
          .eq("profile_id", b.profileId)
          .eq("user_id", b.userId)
          .eq("volume_id", b.volumeId);
        if (error) throw error;
      }
    },
    send: (email) => sendWithMailgun({ ...email, tag: "author-news", unsubscribeUrl: `${site}/account#preferences` }),
    siteOrigin: site,
  })
);
