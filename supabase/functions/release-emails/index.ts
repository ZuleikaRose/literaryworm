// Deploy with JWT verification off (pg_cron sends the Vault secret, not a Supabase token).
// Mailgun's API key and sending domain come from the MAILGUN_API_KEY and MAILGUN_DOMAIN function
// settings; MAILGUN_API_BASE is https://api.eu.mailgun.net for an EU domain. Nothing is hard-coded.
import { allowedOrigins } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import type { DueReminder, Email } from "./email.ts";
import { handle } from "./handler.ts";

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

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

async function sendWithMailgun(email: Email): Promise<void> {
  const domain = env("MAILGUN_DOMAIN");
  const base = (Deno.env.get("MAILGUN_API_BASE") ?? "https://api.mailgun.net").replace(/\/$/, "");
  const form = new FormData();
  form.set("from", Deno.env.get("MAILGUN_FROM") ?? `LiteraryWorm <reminders@${domain}>`);
  form.set("to", email.to);
  form.set("subject", email.subject);
  form.set("text", email.text);
  form.set("html", email.html);
  form.set("o:tag", "release-reminder");
  // No open or click tracking: the Privacy Policy says Mailgun gets the address and the email, nothing more.
  form.set("o:tracking", "no");
  form.set("h:List-Unsubscribe", `<${siteOrigin()}/account#preferences>`);
  const res = await fetch(`${base}/v3/${encodeURIComponent(domain)}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`api:${env("MAILGUN_API_KEY")}`)}` },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Mailgun answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

function siteOrigin(): string {
  const origins = allowedOrigins();
  return origins.find((o) => o.startsWith("https://www.")) ?? origins[0];
}

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
    send: sendWithMailgun,
    siteOrigin: siteOrigin(),
  })
);
