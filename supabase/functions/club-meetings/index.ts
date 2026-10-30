// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts). Nothing is hard-coded.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { unsubscribeToken } from "../_shared/unsubscribe.ts";
import { handle } from "./handler.ts";

const site = publicSiteOrigin();
const functionsBase = `${(Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "")}/functions/v1`;
/** Which email the unsubscribe link turns off (the unsubscribe function's `l`). */
const LIST = "club-meetings";

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

interface ReminderRow {
  meeting_id: string;
  club_id: string;
  club_name: string;
  volume_id: string;
  title: string;
  note: string | null;
  starts_at: string;
  minutes: number;
  time_zone: string;
  user_id: string;
  email: string;
  member_name: string | null;
}

interface ChangeRow {
  meeting_id: string;
  club_id: string;
  club_name: string;
  volume_id: string;
  kind: "moved" | "cancelled";
  title: string;
  note: string | null;
  was_starts_at: string;
  starts_at: string | null;
  minutes: number;
  time_zone: string;
  user_id: string;
  email: string;
  member_name: string | null;
}

Deno.serve((req) =>
  handle(req, {
    async secret() {
      const { data, error } = await serviceClient().rpc("club_meetings_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async claim(max) {
      const { data, error } = await serviceClient().rpc("claim_club_meeting_reminders", { max_count: max });
      if (error) throw error;
      return (data as ReminderRow[]).map((r) => ({
        meeting: {
          id: r.meeting_id,
          clubId: r.club_id,
          clubName: r.club_name,
          bookId: r.volume_id,
          title: r.title,
          note: r.note,
          startsAt: r.starts_at,
          minutes: r.minutes,
          timeZone: r.time_zone,
        },
        userId: r.user_id,
        email: r.email,
        name: r.member_name,
      }));
    },
    async release(meetingId) {
      const { error } = await serviceClient().from("club_meetings").update({ reminded_at: null }).eq("id", meetingId);
      if (error) throw error;
    },
    async claimChanges(max) {
      const { data, error } = await serviceClient().rpc("claim_club_meeting_changes", { max_count: max });
      if (error) throw error;
      return (data as ChangeRow[]).map((r) => ({
        change: {
          kind: r.kind,
          // A cancelled meeting keeps the time it had.
          meeting: {
            id: r.meeting_id,
            clubId: r.club_id,
            clubName: r.club_name,
            bookId: r.volume_id,
            title: r.title,
            note: r.note,
            startsAt: r.starts_at ?? r.was_starts_at,
            minutes: r.minutes,
            timeZone: r.time_zone,
          },
          wasStartsAt: r.was_starts_at,
        },
        userId: r.user_id,
        email: r.email,
        name: r.member_name,
      }));
    },
    async releaseChange(meetingId) {
      const { error } = await serviceClient().from("club_meeting_changes").update({ emailed_at: null }).eq("meeting_id", meetingId);
      if (error) throw error;
    },
    // The site's page for people clicking the link; mail apps' one-click POST goes to the function.
    unsubscribeLink: async (userId) =>
      `${site}/unsubscribe?t=${encodeURIComponent(await unsubscribeToken(userId, await unsubscribeKey()))}&l=${LIST}`,
    send: (email, unsubscribe) =>
      sendWithMailgun({
        ...email,
        tag: "club-meetings",
        unsubscribeUrl: `${functionsBase}/unsubscribe?t=${encodeURIComponent(new URL(unsubscribe).searchParams.get("t") ?? "")}&l=${LIST}`,
        oneClickUnsubscribe: true,
      }),
    siteOrigin: site,
  })
);
