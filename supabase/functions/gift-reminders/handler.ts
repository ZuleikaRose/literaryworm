// POST /functions/v1/gift-reminders — called by pg_cron (private.call_gift_reminders) once a day,
// never by the browser. Emails the buyer of a gift set to start on a later day, three days before
// that day (claim_gift_start_reminders() picks them), once per gift.
//
// The caller must send the secret kept in Vault (Authorization: Bearer …); anything else is
// refused. Gifts are claimed first (gift_codes.reminded_at, so two runs can't send twice); one
// whose email fails is handed back for the next run.

import { sameSecret } from "../whats-new/handler.ts";
import { type Email, type Gift, giftStartEmail } from "./email.ts";

/** One buyer to remind about one gift (what claim_gift_start_reminders() returns). */
export interface Reminder {
  gift: Gift;
  email: string;
  name: string | null;
}

export interface Deps {
  /** The secret from Vault; null when it's missing (then nothing is sent). */
  secret: () => Promise<string | null>;
  claim: (max: number) => Promise<Reminder[]>;
  /** Hands a gift back, so the next run tries again. */
  release: (giftId: string) => Promise<void>;
  send: (email: Email) => Promise<void>;
  siteOrigin: string;
}

/** Gifts claimed in one run; more carry on the next run. */
export const BATCH = 200;

const reply = (status: number, body: unknown) => Response.json(body, { status });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];

  try {
    const expected = await deps.secret();
    if (!expected || !given || !sameSecret(given, expected)) {
      return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
    }
    const due = await deps.claim(BATCH);
    let sent = 0;
    let failed = 0;
    for (const r of due) {
      try {
        await deps.send(giftStartEmail({ to: r.email, name: r.name, gift: r.gift, site: deps.siteOrigin }));
        sent += 1;
      } catch (err) {
        failed += 1;
        console.error(`gift-reminders: reminding about gift ${r.gift.id} failed`, err);
        await deps.release(r.gift.id).catch((e) => console.error(`gift-reminders: handing back gift ${r.gift.id} failed`, e));
      }
    }
    return reply(200, { gifts: due.length, sent, failed });
  } catch (err) {
    console.error("gift-reminders: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
