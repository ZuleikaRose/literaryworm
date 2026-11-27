// POST /functions/v1/recovery-code {"code": "abcde-12345"}: logs a member in with a recovery code
// when they can't use their authenticator app (migration 6866). Called from the log-in page's second
// step, so the session has only the password (aal1): it can't use requireUser(), which refuses that.
//
// The code is checked by check_recovery_code() (rate limited per account, 10 an hour). When it's
// right, two-step sign-in is turned off (the account's authenticator factors are removed through
// Auth's admin API) and every recovery code is deleted; the browser then refreshes its session,
// which no longer needs the second step. Supabase Auth can't raise a session to aal2 without a
// factor, so this is the way back in; the member sets two-step sign-in up again on a new phone.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";

const METHODS = "POST";
/** Generous: the database ignores case, spaces and dashes. */
const CODE_MAX = 40;

export type Member = { id: string; twoStep: boolean };
export type CheckResult = "ok" | "wrong" | "rate_limited";

export type Deps = {
  /** The member the token belongs to (verified by Auth), or null for a bad or ended session. */
  member: (token: string) => Promise<Member | null>;
  check: (userId: string, code: string) => Promise<CheckResult>;
  /** Removes the account's authenticator factors, then its recovery codes. */
  turnOffTwoStep: (userId: string) => Promise<void>;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;
  try {
    requireMethod(req, ["POST"]);
    const token = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new HttpError("unauthorized", "Log in with your password first.");
    const body = await readJsonBody(req);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code || code.length > CODE_MAX || Object.keys(body).length !== 1) {
      throw new HttpError("bad_request", "Send one recovery code.");
    }
    const member = await deps.member(token);
    if (!member) throw new HttpError("unauthorized", "Your session has ended. Log in again.");
    if (!member.twoStep) throw new HttpError("bad_request", "Two-step sign-in isn't on for this account, so there's nothing to recover.");
    const result = await deps.check(member.id, code);
    if (result === "rate_limited") throw new HttpError("rate_limited", "Too many tries. Wait an hour and try again.", 3600);
    if (result !== "ok") throw new HttpError("bad_request", "That recovery code isn't right, or it has been used.");
    await deps.turnOffTwoStep(member.id);
    return json(req, METHODS, { ok: true, twoStep: false });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
