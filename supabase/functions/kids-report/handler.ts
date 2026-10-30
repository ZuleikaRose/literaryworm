// POST /functions/v1/kids-report — called by pg_cron (private.call_kids_report) on Monday and
// Tuesday mornings, never by the browser. Emails last week's reading for every Kids profile to
// each member who turned the weekly report on, once a week.
//
// The caller must send the secret kept in Vault (Authorization: Bearer …); anything else is
// refused. Accounts are claimed first (kids_report_sends, so two runs can't send twice); an
// account whose email Mailgun refuses is handed back for Tuesday's run.

import { sameSecret } from "../whats-new/handler.ts";
import { type Email, type KidWeek, kidsReportEmail } from "./email.ts";

export interface Recipient {
  userId: string;
  email: string;
  name: string | null;
}

export interface Deps {
  /** The secret from Vault; null when it's missing (then nothing is sent). */
  secret: () => Promise<string | null>;
  claim: (week: string, max: number) => Promise<Recipient[]>;
  /** Each Kids profile's reading from `from` to `to` (YYYY-MM-DD, both included). */
  week: (userId: string, from: string, to: string) => Promise<KidWeek[]>;
  /** Hands an account back, so the next run tries again. */
  release: (userId: string, week: string) => Promise<void>;
  /** The account's one-click unsubscribe link for this email. */
  unsubscribeLink: (userId: string) => Promise<string>;
  send: (email: Email, unsubscribe: string) => Promise<void>;
  siteOrigin: string;
  now?: () => Date;
}

/** Accounts emailed in one run; a bigger list carries on the next day. */
export const BATCH = 500;

/** Last week, Monday to Sunday (UTC): its Monday is the week's key. */
export function lastWeek(now: Date): { week: string; from: string; to: string } {
  const day = (d: Date) => d.toISOString().slice(0, 10);
  // Days since this week's Monday (getUTCDay: Sunday is 0).
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday - 7));
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { week: day(monday), from: day(monday), to: day(sunday) };
}

const reply = (status: number, body: unknown) => Response.json(body, { status });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];

  try {
    const expected = await deps.secret();
    if (!expected || !given || !sameSecret(given, expected)) {
      return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
    }
    const { week, from, to } = lastWeek(deps.now?.() ?? new Date());
    const recipients = await deps.claim(week, BATCH);
    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      try {
        const kids = await deps.week(r.userId, from, to);
        // The Kids profiles were deleted since the claim: nothing to report, and nothing to retry.
        if (kids.length === 0) continue;
        const unsubscribe = await deps.unsubscribeLink(r.userId);
        await deps.send(kidsReportEmail({ to: r.email, name: r.name, weekFrom: from, weekTo: to, kids, site: deps.siteOrigin, unsubscribe }), unsubscribe);
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(`kids-report: sending to account ${r.userId} failed`, err);
        await deps.release(r.userId, week).catch((e) => console.error(`kids-report: handing back account ${r.userId} failed`, e));
      }
    }
    return reply(200, { week, accounts: recipients.length, sent, failed });
  } catch (err) {
    console.error("kids-report: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
