// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts). Nothing is hard-coded.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { unsubscribeToken } from "../_shared/unsubscribe.ts";
import type { Entry } from "./email.ts";
import { handle } from "./handler.ts";

const site = publicSiteOrigin();
const functionsBase = `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "")}/functions/v1`;

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

Deno.serve((req) =>
  handle(req, {
    async secret() {
      const { data, error } = await serviceClient().rpc("whats_new_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async entries(from, to) {
      const { data, error } = await serviceClient()
        .from("changelog_entries")
        .select("kind, title, body")
        .eq("major", true)
        .gte("released_on", from)
        .lte("released_on", to)
        .order("released_on", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Entry[];
    },
    async claim(month, max) {
      const { data, error } = await serviceClient().rpc("claim_whats_new_emails", { p_month: month, max_count: max });
      if (error) throw error;
      return (data as { user_id: string; email: string; account_name: string | null }[]).map((r) => ({ userId: r.user_id, email: r.email, name: r.account_name }));
    },
    async release(userId, month) {
      const { error } = await serviceClient().from("whats_new_sends").delete().eq("user_id", userId).eq("month", month);
      if (error) throw error;
    },
    // The site's page for people clicking the link; mail apps' one-click POST goes to the function.
    unsubscribeLink: async (userId) => `${site}/unsubscribe?t=${encodeURIComponent(await unsubscribeToken(userId, await unsubscribeKey()))}`,
    send: (email, unsubscribe) =>
      sendWithMailgun({
        ...email,
        tag: "whats-new",
        unsubscribeUrl: `${functionsBase}/unsubscribe?t=${new URL(unsubscribe).searchParams.get("t") ?? ""}`,
        oneClickUnsubscribe: true,
      }),
    siteOrigin: site,
  })
);
