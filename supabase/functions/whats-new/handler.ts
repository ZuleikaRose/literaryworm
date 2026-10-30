// POST /functions/v1/whats-new — called by pg_cron (private.call_whats_new) on the 1st to the
// 3rd of each month, never by the browser. Emails last month's major What's new entries to
// every member who turned on the monthly round-up, once each.
//
// The caller must send the secret kept in Vault (Authorization: Bearer …); anything else is
// refused. Accounts are claimed first (whats_new_sends, so two runs can't send twice); an
// account whose email Mailgun refuses is handed back for the next day's run.

import { type Email, type Entry, whatsNewEmail } from "./email.ts";

export interface Recipient {
  userId: string;
  email: string;
  name: string | null;
}

export interface Deps {
  /** The secret from Vault; null when it's missing (then nothing is sent). */
  secret: () => Promise<string | null>;
  /** The major entries released from `from` to `to` (YYYY-MM-DD, both included), newest first. */
  entries: (from: string, to: string) => Promise<Entry[]>;
  claim: (month: string, max: number) => Promise<Recipient[]>;
  /** Hands an account back, so the next run tries again. */
  release: (userId: string, month: string) => Promise<void>;
  /** The account's one-click unsubscribe link. */
  unsubscribeLink: (userId: string) => Promise<string>;
  send: (email: Email, unsubscribe: string) => Promise<void>;
  siteOrigin: string;
  now?: () => Date;
}

/** Accounts emailed in one run; a bigger list carries on the next day. */
export const BATCH = 500;

const encoder = new TextEncoder();

/** Compares in time that doesn't depend on where the strings differ. */
export function sameSecret(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Last month: its first and last days (YYYY-MM-DD), in UTC. */
export function lastMonth(now: Date): { month: string; from: string; to: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  const day = (d: Date) => d.toISOString().slice(0, 10);
  return { month: day(start), from: day(start), to: day(end) };
}

const reply = (status: number, body: unknown) => Response.json(body, { status });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];

  try {
    const secret = await deps.secret();
    if (!secret || !given || !sameSecret(given, secret)) {
      return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
    }
    const { month, from, to } = lastMonth(deps.now?.() ?? new Date());
    const entries = await deps.entries(from, to);
    // Nothing major last month: no email at all.
    if (entries.length === 0) return reply(200, { month, entries: 0, accounts: 0, sent: 0, failed: 0 });

    const recipients = await deps.claim(month, BATCH);
    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      try {
        const unsubscribe = await deps.unsubscribeLink(r.userId);
        await deps.send(whatsNewEmail({ to: r.email, name: r.name, month, entries, site: deps.siteOrigin, unsubscribe }), unsubscribe);
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(`whats-new: sending to account ${r.userId} failed`, err);
        await deps.release(r.userId, month).catch((e) => console.error(`whats-new: handing back account ${r.userId} failed`, e));
      }
    }
    return reply(200, { month, entries: entries.length, accounts: recipients.length, sent, failed });
  } catch (err) {
    console.error("whats-new: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
