// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts). Nothing is hard-coded.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { unsubscribeToken } from "../_shared/unsubscribe.ts";
import type { KidWeek } from "./email.ts";
import { handle } from "./handler.ts";

const site = publicSiteOrigin();
const functionsBase = `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "")}/functions/v1`;
/** Which email the unsubscribe link turns off (the unsubscribe function's `l`). */
const LIST = "kids-report";

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

interface WeekRow {
  profile_name: string;
  minutes: number;
  listening_minutes: number;
  days_read: number;
  books_finished: number;
  finished_books: string[] | null;
  weekly_goal_minutes: number | null;
}

Deno.serve((req) =>
  handle(req, {
    async secret() {
      const { data, error } = await serviceClient().rpc("kids_report_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async claim(week, max) {
      const { data, error } = await serviceClient().rpc("claim_kids_report_emails", { p_week: week, max_count: max });
      if (error) throw error;
      return (data as { user_id: string; email: string; account_name: string | null }[]).map((r) => ({ userId: r.user_id, email: r.email, name: r.account_name }));
    },
    async week(userId, from, to) {
      const { data, error } = await serviceClient().rpc("kids_report_week", { p_user: userId, p_from: from, p_to: to });
      if (error) throw error;
      return (data as WeekRow[]).map(
        (r): KidWeek => ({
          name: r.profile_name,
          minutes: r.minutes,
          listeningMinutes: r.listening_minutes,
          daysRead: r.days_read,
          booksFinished: r.books_finished,
          finishedBooks: r.finished_books ?? [],
          goalMinutes: r.weekly_goal_minutes,
        }),
      );
    },
    async release(userId, week) {
      const { error } = await serviceClient().from("kids_report_sends").delete().eq("user_id", userId).eq("week", week);
      if (error) throw error;
    },
    // The site's page for people clicking the link; mail apps' one-click POST goes to the function.
    unsubscribeLink: async (userId) =>
      `${site}/unsubscribe?t=${encodeURIComponent(await unsubscribeToken(userId, await unsubscribeKey()))}&l=${LIST}`,
    send: (email, unsubscribe) =>
      sendWithMailgun({
        ...email,
        tag: "kids-report",
        unsubscribeUrl: `${functionsBase}/unsubscribe?t=${encodeURIComponent(new URL(unsubscribe).searchParams.get("t") ?? "")}&l=${LIST}`,
        oneClickUnsubscribe: true,
      }),
    siteOrigin: site,
  })
);
