// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts). Nothing is hard-coded.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { unsubscribeToken } from "../_shared/unsubscribe.ts";
import { handle } from "./handler.ts";

const site = publicSiteOrigin();
const functionsBase = `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "")}/functions/v1`;
/** Which email the unsubscribe link turns off (the unsubscribe function's `l`). */
const LIST = "club-posts";

// The signing key for unsubscribe links, read once per warm instance.
let signingKey: Promise<string> | null = null;
function unsubscribeKey(): Promise<string> {
  signingKey ??= (async () => {
    const { data, error } = await serviceClient().rpc("unsubscribe_secret");
    if (error || typeof data !== "string" || !data) throw error ?? new Error("No unsubscribe key in Vault");
    return data;
  })();
  signingKey.catch(() => (signingKey = null));
  return signingKey;
}

interface Row {
  user_id: string;
  email: string;
  member_name: string | null;
  club_id: string;
  club_name: string;
  volume_id: string;
  chapter_index: number;
  posts: number;
  authors: string[];
  was_through: string | null;
}

Deno.serve((req) =>
  handle(req, {
    async secret() {
      const { data, error } = await serviceClient().rpc("club_digest_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async claim(max) {
      const { data, error } = await serviceClient().rpc("claim_club_post_digests", { max_count: max });
      if (error) throw error;
      return (data as Row[]).map((r) => ({
        userId: r.user_id,
        email: r.email,
        name: r.member_name,
        clubId: r.club_id,
        clubName: r.club_name,
        bookId: r.volume_id,
        chapterIndex: r.chapter_index,
        posts: Number(r.posts),
        authors: r.authors ?? [],
        wasThrough: r.was_through,
      }));
    },
    async release(userId, wasThrough) {
      const { error } = await serviceClient().from("account_private").update({ club_posts_emailed_through: wasThrough }).eq("user_id", userId);
      if (error) throw error;
    },
    // The site's page for people clicking the link; mail apps' one-click POST goes to the function.
    unsubscribeLink: async (userId) =>
      `${site}/unsubscribe?t=${encodeURIComponent(await unsubscribeToken(userId, await unsubscribeKey()))}&l=${LIST}`,
    send: (email, unsubscribe) =>
      sendWithMailgun({
        ...email,
        tag: "club-posts",
        unsubscribeUrl: `${functionsBase}/unsubscribe?t=${encodeURIComponent(new URL(unsubscribe).searchParams.get("t") ?? "")}&l=${LIST}`,
        oneClickUnsubscribe: true,
      }),
    siteOrigin: site,
  })
);
