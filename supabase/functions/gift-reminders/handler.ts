// POST /functions/v1/gift-reminders — called by pg_cron (private.call_gift_reminders) every hour,
// never by the browser. Two jobs, each once per gift:
//   - emails a gift to its recipient, when the buyer gave an address, once it can be redeemed
//     (claim_gift_deliveries() picks them; the address and message are cleared once it's sent);
//   - emails the buyer of a gift set to start on a later day, three days before that day, in the
//     afternoon UTC (claim_gift_start_reminders() picks them; not for gifts we email ourselves).
//
// The caller must send the key kept in Vault (Authorization: Bearer …); anything else is refused.
// Gifts are claimed first (gift_codes.delivered_at and .reminded_at, so two runs can't send
// twice); one whose email fails is handed back for the next run.

import { sameSecret } from "../whats-new/handler.ts";
import { type Delivery, type Email, type Gift, giftDeliveryEmail, giftStartEmail } from "./email.ts";

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
  /** Gifts to email to their recipients now, claimed (gift_codes.delivered_at). */
  claimDeliveries: (max: number) => Promise<Delivery[]>;
  /** A delivery that failed: unclaimed, so the next run tries again. */
  releaseDelivery: (giftId: string) => Promise<void>;
  /** A delivery that went: forgets the recipient's address and the message. */
  delivered: (giftId: string) => Promise<void>;
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
    const deliveries = await deps.claimDeliveries(BATCH);
    let delivered = 0;
    let undelivered = 0;
    for (const d of deliveries) {
      try {
        await deps.send(giftDeliveryEmail({ delivery: d, site: deps.siteOrigin }));
        delivered += 1;
      } catch (err) {
        undelivered += 1;
        console.error(`gift-reminders: emailing gift ${d.gift.id} to its recipient failed`, err);
        await deps.releaseDelivery(d.gift.id).catch((e) => console.error(`gift-reminders: handing back gift ${d.gift.id} failed`, e));
        continue;
      }
      // Sent: a failure here only means the address is kept a little longer.
      await deps.delivered(d.gift.id).catch((e) => console.error(`gift-reminders: clearing gift ${d.gift.id}'s recipient failed`, e));
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
    return reply(200, { gifts: due.length, sent, failed, deliveries: deliveries.length, delivered, undelivered });
  } catch (err) {
    console.error("gift-reminders: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
