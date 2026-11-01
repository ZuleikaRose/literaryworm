// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts: MAILGUN_API_KEY and MAILGUN_DOMAIN
// function settings). Nothing is hard-coded.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { serviceDeviceDeps } from "../_shared/pushAccount.ts";
import { pushMore } from "./more.ts";
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
    push: async () => {
      const devices = serviceDeviceDeps();
      const releases = await pushReleases({
        ...devices,
        async claim(max) {
          const { data, error } = await serviceClient().rpc("claim_release_pushes", { max_count: max });
          if (error) throw error;
          return (data as { user_id: string; profile_name: string | null; volume_id: string; title: string; author: string | null }[]).map(
            (r): DuePush => ({ userId: r.user_id, profileName: r.profile_name, volumeId: r.volume_id, title: r.title, author: r.author }),
          );
        },
      });
      const rpc = async <T>(name: string, max: number): Promise<T[]> => {
        const { data, error } = await serviceClient().rpc(name, { max_count: max });
        if (error) throw error;
        return data as T[];
      };
      const others = await pushMore({
        ...devices,
        meetings: async (max) =>
          (await rpc<{ user_id: string; club_id: string; club_name: string; title: string; starts_at: string }>("claim_meeting_pushes", max)).map((r) => ({
            userId: r.user_id,
            clubId: r.club_id,
            clubName: r.club_name,
            title: r.title,
            startsAt: r.starts_at,
          })),
        posts: async (max) =>
          (await rpc<{ user_id: string; club_id: string; club_name: string; last_chapter: number; posts: number; authors: string[] }>("claim_club_post_pushes", max)).map((r) => ({
            userId: r.user_id,
            clubId: r.club_id,
            clubName: r.club_name,
            lastChapter: r.last_chapter,
            posts: Number(r.posts),
            authors: r.authors,
          })),
        streaks: async (max) =>
          (await rpc<{ user_id: string; profile_name: string; days: number }>("claim_streak_pushes", max)).map((r) => ({ userId: r.user_id, profileName: r.profile_name, days: r.days })),
      });
      return { releases, others };
    },
  })
);
