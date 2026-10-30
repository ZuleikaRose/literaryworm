// POST /functions/v1/unsubscribe?t=<token>     one-click from the mail app (RFC 8058)
// POST /functions/v1/unsubscribe { "token" }   the site's /unsubscribe page
// Turns off the monthly What's new email for the account a signed link is for, without signing
// in. The token is checked against the unsubscribe_secret kept in Vault (_shared/unsubscribe.ts);
// a link can only ever switch its own account's email off, never on, and nothing else.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { checkUnsubscribeToken } from "../_shared/unsubscribe.ts";
import { onlyKeys } from "../_shared/validate.ts";

const METHODS = "POST";

export interface Deps {
  /** The signing key from Vault. */
  key: () => Promise<string>;
  /** Turns the account's monthly email off. */
  turnOff: (userId: string) => Promise<void>;
  rateLimit?: (req: Request) => Promise<void>;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    await deps.rateLimit?.(req);
    // Mail apps send the token in the link and a form body we don't need; the site sends JSON.
    let token: unknown = new URL(req.url).searchParams.get("t");
    if (!token) {
      const body = await readJsonBody(req);
      onlyKeys(body, ["token"]);
      token = body.token;
    }
    const userId = await checkUnsubscribeToken(token, await deps.key());
    if (!userId) throw new HttpError("bad_request", "This unsubscribe link isn't valid. Turn the email off in Account → Preferences instead.");
    await deps.turnOff(userId);
    return json(req, METHODS, { unsubscribed: true });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
