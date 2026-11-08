// POST /functions/v1/year-in-reading — called by pg_cron (private.call_year_in_reading) on 1 to 3
// January, never by the browser. Emails the year just ended, for every profile in the household,
// to each member who turned Year in reading on, once a year.
//
// The caller must send the key kept in Vault (Authorization: Bearer …); anything else is refused.
// Accounts are claimed first (year_in_reading_sends, so two runs can't send twice); an account
// whose email Mailgun refuses is handed back for the next day's run.

import { sameSecret } from "../whats-new/handler.ts";
import { type Email, type ProfileYear, yearEmail } from "./email.ts";

export interface Recipient {
  userId: string;
  email: string;
  name: string | null;
}

export interface Deps {
  /** The key from Vault; null when it's missing (then nothing is sent). */
  secret: () => Promise<string | null>;
  claim: (year: number, max: number) => Promise<Recipient[]>;
  /** Each profile's year. */
  year: (userId: string, year: number) => Promise<ProfileYear[]>;
  /** Hands an account back, so the next run tries again. */
  release: (userId: string, year: number) => Promise<void>;
  /** The account's one-click unsubscribe link for this email. */
  unsubscribeLink: (userId: string) => Promise<string>;
  send: (email: Email, unsubscribe: string) => Promise<void>;
  siteOrigin: string;
  now?: () => Date;
}

/** Accounts emailed in one run; a bigger list carries on the next day. */
export const BATCH = 500;

/** The year just ended (UTC): the runs are on 1 to 3 January. */
export const lastYear = (now: Date) => now.getUTCFullYear() - 1;

const reply = (status: number, body: unknown) => Response.json(body, { status });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];

  try {
    const expected = await deps.secret();
    if (!expected || !given || !sameSecret(given, expected)) {
      return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
    }
    const year = lastYear(deps.now?.() ?? new Date());
    const recipients = await deps.claim(year, BATCH);
    let sent = 0;
    let failed = 0;
    for (const r of recipients) {
      try {
        const profiles = (await deps.year(r.userId, year)).filter((p) => p.minutes > 0 || p.booksFinished > 0);
        // Nothing read after all (the profiles were deleted since the claim): nothing to send or retry.
        if (profiles.length === 0) continue;
        const unsubscribe = await deps.unsubscribeLink(r.userId);
        await deps.send(yearEmail({ to: r.email, name: r.name, year, profiles, site: deps.siteOrigin, unsubscribe }), unsubscribe);
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(`year-in-reading: sending to account ${r.userId} failed`, err);
        await deps.release(r.userId, year).catch((e) => console.error(`year-in-reading: handing back account ${r.userId} failed`, e));
      }
    }
    return reply(200, { year, accounts: recipients.length, sent, failed });
  } catch (err) {
    console.error("year-in-reading: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
