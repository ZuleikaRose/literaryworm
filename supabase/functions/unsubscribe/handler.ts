// POST /functions/v1/unsubscribe?t=<token>&l=<list>     one-click from the mail app (RFC 8058)
// POST /functions/v1/unsubscribe { "token", "list"? }   the site's /unsubscribe page
// Turns off one optional email for the account a signed link is for, without signing in: the
// monthly What's new email ("whats-new", the default) or the weekly Kids reading report
// ("kids-report"). The token is checked against the unsubscribe_secret kept in Vault
// (_shared/unsubscribe.ts); a link can only ever switch its own account's emails off, never on.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { checkUnsubscribeToken } from "../_shared/unsubscribe.ts";
import { onlyKeys } from "../_shared/validate.ts";

const METHODS = "POST";

/** The optional emails a link can turn off. */
export const LISTS = ["whats-new", "kids-report"] as const;
export type List = (typeof LISTS)[number];

export interface Deps {
  /** The signing key from Vault. */
  key: () => Promise<string>;
  /** Turns one of the account's optional emails off. */
  turnOff: (userId: string, list: List) => Promise<void>;
  rateLimit?: (req: Request) => Promise<void>;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    await deps.rateLimit?.(req);
    // Mail apps send the token in the link and a form body we don't need; the site sends JSON.
    const query = new URL(req.url).searchParams;
    let token: unknown = query.get("t");
    let list: unknown = query.get("l") ?? undefined;
    if (!token) {
      const body = await readJsonBody(req);
      onlyKeys(body, ["token", "list"]);
      token = body.token;
      list = body.list;
    }
    list ??= "whats-new";
    if (!LISTS.includes(list as List)) {
      throw new HttpError("bad_request", "This unsubscribe link isn't valid. Turn the email off in Account instead.");
    }
    const userId = await checkUnsubscribeToken(token, await deps.key());
    if (!userId) throw new HttpError("bad_request", "This unsubscribe link isn't valid. Turn the email off in Account → Preferences instead.");
    await deps.turnOff(userId, list as List);
    return json(req, METHODS, { unsubscribed: true });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
