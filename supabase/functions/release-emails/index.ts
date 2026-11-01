// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts: MAILGUN_API_KEY and MAILGUN_DOMAIN
// function settings). Nothing is hard-coded.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { sendPush } from "../_shared/webpush.ts";
import { type DuePush, pushReleases } from "./push.ts";
import type { DueReminder } from "./email.ts";
import { handle } from "./handler.ts";

interface ClaimedRow {
  user_id: string;
  email: string;
  account_name: string | null;
  profile_id: string;
  profile_name: string | null;
  volume_id: string;
  title: string;
  author: string | null;
  release_date: string;
}

const site = publicSiteOrigin();

Deno.serve((req) =>
  handle(req, {
    async secret() {
      const { data, error } = await serviceClient().rpc("release_emails_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async claim(max) {
      const { data, error } = await serviceClient().rpc("claim_release_emails", { max_count: max });
      if (error) throw error;
      return (data as ClaimedRow[]).map(
        (r): DueReminder => ({
          userId: r.user_id,
          email: r.email,
          accountName: r.account_name,
          profileId: r.profile_id,
          profileName: r.profile_name,
          volumeId: r.volume_id,
          title: r.title,
          author: r.author,
          releaseDate: r.release_date,
        }),
      );
    },
    async release(reminders) {
      const db = serviceClient();
      for (const r of reminders) {
        const { error } = await db
          .from("release_reminders")
          .update({ emailed_at: null })
          .eq("profile_id", r.profileId)
          .eq("user_id", r.userId)
          .eq("volume_id", r.volumeId);
        if (error) throw error;
      }
    },
    send: (email) => sendWithMailgun({ ...email, tag: "release-reminder", unsubscribeUrl: `${site}/account#preferences` }),
    siteOrigin: site,
    push: () =>
      pushReleases({
        async claim(max) {
          const { data, error } = await serviceClient().rpc("claim_release_pushes", { max_count: max });
          if (error) throw error;
          return (data as { user_id: string; profile_name: string | null; volume_id: string; title: string; author: string | null }[]).map(
            (r): DuePush => ({ userId: r.user_id, profileName: r.profile_name, volumeId: r.volume_id, title: r.title, author: r.author }),
          );
        },
        async devices(userIds) {
          const { data, error } = await serviceClient().from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
          if (error) throw error;
          return data.map((d) => ({ id: d.id, userId: d.user_id, endpoint: d.endpoint, p256dh: d.p256dh, auth: d.auth }));
        },
        send: (device, message) => sendPush(device, message),
        async forget(ids) {
          const { error } = await serviceClient().from("push_subscriptions").delete().in("id", ids);
          if (error) throw error;
        },
        async touch(ids) {
          const { error } = await serviceClient().from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", ids);
          if (error) throw error;
        },
      }),
  })
);
