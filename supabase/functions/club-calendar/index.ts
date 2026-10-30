// Deploy with JWT verification off (calendar apps send no Supabase token; POST checks the session).
import { publicSiteOrigin } from "../_shared/mailgun.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { handle } from "./handler.ts";

interface MeetingRow {
  id: string;
  starts_at: string;
  minutes: number;
  title: string;
  note: string | null;
}

Deno.serve((req) =>
  handle(req, {
    requireUser,
    // Links: a few a minute per member. Feeds: calendar apps look every 15 minutes to a day.
    rateLimit: (key) => (key.includes(":link:") ? enforceRateLimit(key, 10, 60) : enforceRateLimit(key, 60, 3600)),
    async key() {
      const { data, error } = await serviceClient().rpc("club_calendar_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async isMember(clubId, userId) {
      const { count, error } = await serviceClient().from("club_members")
        .select("user_id", { count: "exact", head: true })
        .eq("club_id", clubId).eq("user_id", userId);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    async club(clubId) {
      const { data, error } = await serviceClient().from("book_clubs").select("id, name, volume_id").eq("id", clubId).maybeSingle();
      if (error) throw error;
      return data ? { id: data.id, name: data.name, volumeId: data.volume_id } : null;
    },
    async meetings(clubId, since) {
      const { data, error } = await serviceClient().from("club_meetings")
        .select("id, starts_at, minutes, title, note")
        .eq("club_id", clubId).gte("starts_at", since.toISOString())
        .order("starts_at").limit(100);
      if (error) throw error;
      return (data as MeetingRow[]).map((m) => ({ id: m.id, startsAt: m.starts_at, minutes: m.minutes, title: m.title, note: m.note }));
    },
    feedBase: `${Deno.env.get("SUPABASE_URL")}/functions/v1/club-calendar`,
    siteOrigin: publicSiteOrigin(),
  })
);
