// POST /functions/v1/check-password {"password": "…"}: checks the signed-in member's own account
// password for the app's grown-up gates (verifyPassword() in lib/accountApi.ts: adding a passkey,
// making recovery codes, Kids and household changes). Answers { ok: true | false }.
//
// The browser used to ask Supabase Auth directly, but with CAPTCHA protection on (Cloudflare
// Turnstile on the log-in and sign-up pages) a password check needs a token; on the server it's
// asked with the service role key, which Auth lets through. Only the caller's own email is checked
// (from the session, never the request), after a full log-in, and each account gets 20 tries in
// 15 minutes, so it's no easier to guess a password here than on the log-in page.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";

const METHODS = "POST";
/** Supabase Auth reads at most 72 bytes of a password; the app allows up to 64 characters. */
const PASSWORD_MAX = 256;

export type Deps = {
  /** The signed-in member (both steps done), or throws HttpError("unauthorized"). */
  member: (req: Request) => Promise<{ id: string; email: string | undefined }>;
  /** True while this account may try again (20 in 15 minutes). */
  mayTry: (userId: string) => Promise<boolean>;
  /** Resolves when the password is right; throws HttpError("forbidden") when it isn't. */
  confirm: (email: string, password: string) => Promise<void>;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;
  try {
    requireMethod(req, ["POST"]);
    const member = await deps.member(req);
    const body = await readJsonBody(req);
    const password = body.password;
    if (typeof password !== "string" || !password || password.length > PASSWORD_MAX || Object.keys(body).length !== 1) {
      throw new HttpError("bad_request", "Send one password.");
    }
    if (!member.email) throw new HttpError("bad_request", "This account has no email address to check a password for.");
    if (!(await deps.mayTry(member.id))) {
      throw new HttpError("rate_limited", "Too many tries in a short time. Wait a few minutes, then try again.", 900);
    }
    try {
      await deps.confirm(member.email, password);
    } catch (err) {
      if (err instanceof HttpError && err.code === "forbidden") return json(req, METHODS, { ok: false });
      throw err;
    }
    return json(req, METHODS, { ok: true });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
