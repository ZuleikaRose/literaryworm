// Sending email through Mailgun's API, for release-emails and club-invite. The API key and
// sending domain come from the SEND_MAILGUN_EMAIL and MAILGUN_DOMAIN function settings;
// MAILGUN_API_BASE is https://api.eu.mailgun.net for an EU domain, and MAILGUN_FROM changes the
// sender. Nothing is hard-coded. Auth's own emails go through Mailgun's SMTP instead.

import { allowedOrigins } from "./cors.ts";

export interface MailgunMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Mailgun tag, for its delivery stats. */
  tag: string;
  /** A page where the recipient can turn these emails off (List-Unsubscribe). */
  unsubscribeUrl?: string;
  /** The unsubscribe URL takes a one-click POST from the mail app (RFC 8058, List-Unsubscribe-Post). */
  oneClickUnsubscribe?: boolean;
  /** A file sent with the email (club-meetings sends the updated calendar file). */
  attachment?: { filename: string; content: string; contentType: string };
}

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** The public site, for links in emails: the www origin in ALLOWED_ORIGINS. */
export function publicSiteOrigin(): string {
  const origins = allowedOrigins();
  return origins.find((o) => o.startsWith("https://www.")) ?? origins[0];
}

/** Sends one email; throws when Mailgun refuses it, doesn't answer in 15 s, or a setting is missing. */
export async function sendWithMailgun(message: MailgunMessage): Promise<void> {
  const domain = env("MAILGUN_DOMAIN");
  const base = (Deno.env.get("MAILGUN_API_BASE") ?? "https://api.mailgun.net").replace(/\/$/, "");
  const form = new FormData();
  form.set("from", Deno.env.get("MAILGUN_FROM") ?? `LiteraryWorm <hello@${domain}>`);
  form.set("to", message.to);
  form.set("subject", message.subject);
  form.set("text", message.text);
  form.set("html", message.html);
  form.set("o:tag", message.tag);
  // No open or click tracking: the Privacy Policy says Mailgun gets the address and the email, nothing more.
  form.set("o:tracking", "no");
  if (message.unsubscribeUrl) form.set("h:List-Unsubscribe", `<${message.unsubscribeUrl}>`);
  if (message.unsubscribeUrl && message.oneClickUnsubscribe) form.set("h:List-Unsubscribe-Post", "List-Unsubscribe=One-Click");
  if (message.attachment) {
    const { filename, content, contentType } = message.attachment;
    form.append("attachment", new Blob([content], { type: contentType }), filename);
  }
  const res = await fetch(`${base}/v3/${encodeURIComponent(domain)}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`api:${env("SEND_MAILGUN_EMAIL")}`)}` },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Mailgun answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
