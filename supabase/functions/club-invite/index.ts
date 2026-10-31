// Emails go through Mailgun's API (_shared/mailgun.ts: MAILGUN_API_KEY and MAILGUN_DOMAIN
// function settings). Nothing is hard-coded.
import { CATALOG } from "../_shared/catalog.ts";
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { enforceRateLimit } from "../_shared/rateLimit.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";
import { handle, type RecordResult } from "./handler.ts";

Deno.serve((req) =>
  handle(req, {
    requireUser,
    // Separate from the 10-a-day cap in the database: this one stops bursts.
    rateLimit: (userId) => enforceRateLimit(`club-invite:${userId}`, 5, 60),
    async record(userId, clubId, emailHash) {
      const { data, error } = await serviceClient().rpc("record_club_invite", {
        p_user: userId,
        p_club: clubId,
        p_email_hash: emailHash,
      });
      if (error) throw error;
      return data as RecordResult;
    },
    async forget(inviteId) {
      const { error } = await serviceClient().from("club_invites").delete().eq("id", inviteId);
      if (error) throw error;
    },
    send: (email) => sendWithMailgun({ ...email, tag: "club-invite" }),
    // Clubs are around catalog titles; anything else is named in the email without a title.
    bookTitle: (volumeId) => CATALOG[volumeId]?.title ?? null,
    siteOrigin: publicSiteOrigin(),
  })
);
