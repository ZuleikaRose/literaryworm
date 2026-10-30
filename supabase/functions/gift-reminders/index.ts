// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts). Nothing is hard-coded.
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { handle } from "./handler.ts";
import type { Gift } from "./email.ts";

interface DeliveryRow {
  gift_id: string;
  code: string;
  plan_id: Gift["planId"];
  months: Gift["months"];
  starts_on: string | null;
  recipient_email: string;
  message: string | null;
  buyer_name: string | null;
}

interface ReminderRow {
  gift_id: string;
  plan_id: Gift["planId"];
  months: Gift["months"];
  starts_on: string;
  email: string;
  buyer_name: string | null;
}

Deno.serve((req) =>
  handle(req, {
    async secret() {
      const { data, error } = await serviceClient().rpc("gift_reminders_secret");
      if (error) throw error;
      return typeof data === "string" && data ? data : null;
    },
    async claim(max) {
      const { data, error } = await serviceClient().rpc("claim_gift_start_reminders", { max_count: max });
      if (error) throw error;
      return (data as ReminderRow[]).map((r) => ({
        gift: { id: r.gift_id, planId: r.plan_id, months: r.months, startsOn: r.starts_on },
        email: r.email,
        name: r.buyer_name,
      }));
    },
    async release(giftId) {
      const { error } = await serviceClient().from("gift_codes").update({ reminded_at: null }).eq("id", giftId);
      if (error) throw error;
    },
    async claimDeliveries(max) {
      const { data, error } = await serviceClient().rpc("claim_gift_deliveries", { max_count: max });
      if (error) throw error;
      return (data as DeliveryRow[]).map((r) => ({
        gift: { id: r.gift_id, code: r.code, planId: r.plan_id, months: r.months, startsOn: r.starts_on },
        to: r.recipient_email,
        message: r.message,
        from: r.buyer_name,
      }));
    },
    async releaseDelivery(giftId) {
      const { error } = await serviceClient().from("gift_codes").update({ delivered_at: null }).eq("id", giftId);
      if (error) throw error;
    },
    async delivered(giftId) {
      const { error } = await serviceClient().from("gift_codes").update({ recipient_email: null, message: null }).eq("id", giftId);
      if (error) throw error;
    },
    send: (email) => sendWithMailgun({ ...email, tag: "gift-reminders" }),
    siteOrigin: publicSiteOrigin(),
  })
);
