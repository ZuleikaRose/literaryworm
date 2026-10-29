// POST /functions/v1/release-emails — called every hour by pg_cron (private.call_release_emails),
// never by the browser. Emails each account about the reminded books that came out.
//
// The caller must send the secret kept in Vault (Authorization: Bearer …); anything else is
// refused. Due reminders are claimed first (marked emailed, so two runs can't send the same one);
// an account whose email Mailgun refuses gets its reminders handed back for the next run.

import { type DueReminder, type Email, releaseEmail } from "./email.ts";

export interface Deps {
  /** The secret from Vault; null when it's missing (then nothing is sent). */
  secret: () => Promise<string | null>;
  claim: (max: number) => Promise<DueReminder[]>;
  /** Marks these reminders as not emailed again, for the next run. */
  release: (reminders: DueReminder[]) => Promise<void>;
  send: (email: Email) => Promise<void>;
  siteOrigin: string;
}

/** Most reminders handled in one run; the rest wait an hour. */
export const BATCH = 200;

const encoder = new TextEncoder();

/** Compares in time that doesn't depend on where the strings differ. */
export function sameSecret(a: string, b: string): boolean {
  const x = encoder.encode(a);
  const y = encoder.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function byAccount(reminders: DueReminder[]): DueReminder[][] {
  const groups = new Map<string, DueReminder[]>();
  for (const r of reminders) groups.set(r.userId, [...(groups.get(r.userId) ?? []), r]);
  return [...groups.values()];
}

const reply = (status: number, body: unknown) => Response.json(body, { status });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
  const secret = await deps.secret();
  if (!secret || !given || !sameSecret(given, secret)) {
    return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
  }

  try {
    const due = await deps.claim(BATCH);
    let sent = 0;
    let failed = 0;
    for (const books of byAccount(due)) {
      try {
        await deps.send(releaseEmail(books, deps.siteOrigin));
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(`release-emails: sending to account ${books[0].userId} failed`, err);
        // If even this fails, those reminders stay on Home; only their email is lost.
        await deps.release(books).catch((e) => console.error(`release-emails: handing back account ${books[0].userId}'s reminders failed`, e));
      }
    }
    return reply(200, { accounts: sent + failed, sent, failed });
  } catch (err) {
    console.error("release-emails: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
