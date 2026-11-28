// POST /functions/v1/sign-in-alerts — called by pg_cron (private.call_sign_in_alerts) every five
// minutes, never by the browser. Emails each new log-in once (claim_sign_in_alerts() picks them:
// two minutes after the log-in, while its session exists, for accounts that haven't turned the
// emails off); one whose email fails is handed back for the next run.
//
// The caller must send the key kept in Vault (Authorization: Bearer …); anything else is refused.

import { sameSecret } from "../whats-new/handler.ts";
import { type Alert, type Email, signInAlertEmail } from "./email.ts";

export interface Deps {
  /** The secret from Vault; null when it's missing (then nothing is sent). */
  secret: () => Promise<string | null>;
  claim: (max: number) => Promise<Alert[]>;
  /** Hands an alert back, so the next run tries again. */
  release: (sessionId: string) => Promise<void>;
  send: (email: Email) => Promise<void>;
  siteOrigin: string;
}

/** Alerts claimed in one run; more carry on the next run. */
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
    for (const alert of due) {
      try {
        await deps.send(signInAlertEmail({ alert, site: deps.siteOrigin }));
        sent += 1;
      } catch (err) {
        failed += 1;
        // Never the address: the session id is enough to find it.
        console.error(`sign-in-alerts: emailing about session ${alert.sessionId} failed`, err);
        await deps.release(alert.sessionId).catch((e) => console.error(`sign-in-alerts: handing back session ${alert.sessionId} failed`, e));
      }
    }
    return reply(200, { sent, failed });
  } catch (err) {
    console.error("sign-in-alerts: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong." } });
  }
}
