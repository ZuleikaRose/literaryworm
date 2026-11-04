// POST /functions/v1/affiliate-click {"code": "ABCDEFGH23"}: counts one visit to an affiliate's
// sign-up link (stories 82–84). Public, so the code is validated and each visitor's IP may count
// at most once per code per day (the limit's key is hashed in the database; the IP is never stored).
// Unknown, unapproved and repeated clicks get the same answer, so nothing can be learnt from it.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";

const METHODS = "POST";
export const AFFILIATE_CODE = /^[A-HJ-NP-Z2-9]{10}$/;

export type Deps = {
  /** True when this visitor may count a click for this code today (one per IP, code and day). */
  firstToday: (req: Request, code: string) => Promise<boolean>;
  /** Adds one to the affiliate's count for today (ignored for unknown or unapproved codes). */
  record: (code: string) => Promise<void>;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;
  try {
    requireMethod(req, ["POST"]);
    const body = await readJsonBody(req);
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!AFFILIATE_CODE.test(code) || Object.keys(body).length !== 1) throw new HttpError("bad_request", "Send one affiliate code.");
    if (await deps.firstToday(req, code)) await deps.record(code);
    return json(req, METHODS, { ok: true });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
