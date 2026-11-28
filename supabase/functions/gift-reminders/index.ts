// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Emails go through Mailgun's API (_shared/mailgun.ts). Nothing is hard-coded.
import { addressLanguages, giftBuyerLanguage } from "../_shared/accountLanguage.ts";
import { CATALOG } from "../_shared/catalog.ts";
import { type EmailLanguage, emailLanguage } from "../_shared/emailI18n.ts";
import { publicSiteOrigin, sendWithMailgun } from "../_shared/mailgun.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { handle } from "./handler.ts";
import type { Gift } from "./email.ts";

interface DeliveryRow {
  gift_id: string;
  code: string;
  plan_id: Gift["planId"];
  months: Gift["months"];
  credit_cents: number | null;
  voice_hours: number | null;
  starts_on: string | null;
  recipient_email: string;
  message: string | null;
  buyer_name: string | null;
  books: string[] | null;
}

interface ReminderRow {
  gift_id: string;
  plan_id: Gift["planId"];
  months: Gift["months"];
  credit_cents: number | null;
  voice_hours: number | null;
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
      const languageOf = await addressLanguages((data as ReminderRow[]).map((r) => r.email));
      return (data as ReminderRow[]).map((r) => ({
        language: languageOf(r.email),
        gift: { id: r.gift_id, planId: r.plan_id, months: r.months, creditCents: r.credit_cents, voiceHours: r.voice_hours, startsOn: r.starts_on },
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
      const rows = data as DeliveryRow[];
      // The recipient's own language when their address has an account, else the buyer's.
      const own = new Map<string, EmailLanguage>();
      const found = await serviceClient().rpc("email_languages", { p_emails: rows.map((r) => r.recipient_email) });
      if (found.error) console.error("gift-reminders: couldn't read recipients' languages:", found.error.message);
      for (const x of (found.data ?? []) as { email: string; language: string }[]) own.set(x.email.toLowerCase(), emailLanguage(x.language));
      const languages = await Promise.all(rows.map((r) => own.get(r.recipient_email.toLowerCase()) ?? giftBuyerLanguage(r.gift_id)));
      return rows.map((r, i) => ({
        language: languages[i],
        gift: { id: r.gift_id, code: r.code, planId: r.plan_id, months: r.months, creditCents: r.credit_cents, voiceHours: r.voice_hours, startsOn: r.starts_on },
        to: r.recipient_email,
        message: r.message,
        from: r.buyer_name,
        // Titles from the catalog; an id it no longer has is left out.
        books: (r.books ?? []).flatMap((id) => (CATALOG[id] ? [{ title: CATALOG[id].title, author: CATALOG[id].author }] : [])),
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
