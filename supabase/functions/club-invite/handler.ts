// POST /functions/v1/club-invite — a club member invites someone by email.
// Requires a signed-in account (JWT, and the two-step code when it's on).
//
//   { clubId: uuid, email: string }  →  { sent: true }
//
// The database (record_club_invite) checks the caller is in the club, the club isn't full, the
// caller hasn't sent 10 invitations in the last day, and the address wasn't invited to this club
// in the last week; it keeps only a fingerprint of the address. The email (through Mailgun) links
// to /clubs/join/<code>. If Mailgun refuses it, the invitation is forgotten so it can be sent again.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseUuid } from "../_shared/validate.ts";
import { type InviteEmail, inviteEmail } from "./email.ts";

const METHODS = "POST";

export type RecordResult =
  | { status: "ok"; invite_id: string; club_name: string; volume_id: string; finishes_on: string; invite_code: string; inviter_name: string | null }
  | { status: "not_member" | "full" | "too_many" | "already_invited" };

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string; email?: string }>;
  rateLimit: (userId: string) => Promise<void>;
  record: (userId: string, clubId: string, emailHash: string) => Promise<RecordResult>;
  /** Removes an invitation that couldn't be sent, so the member can try again. */
  forget: (inviteId: string) => Promise<void>;
  send: (email: InviteEmail) => Promise<void>;
  bookTitle: (volumeId: string) => string | null;
  siteOrigin: string;
}

// Deliberately plain: one @, something before it, a dot in the domain, no spaces or angle brackets.
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

/** An email address as a member types it, lower-cased. */
export function parseEmail(raw: unknown): string {
  if (typeof raw !== "string") throw new HttpError("bad_request", "Enter an email address.");
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) throw new HttpError("bad_request", "Enter an email address like name@example.com.");
  return email;
}

/** The fingerprint kept instead of the address: sha256 of the club and the address, in hex. */
export async function emailHash(clubId: string, email: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${clubId}:${email}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const REFUSALS: Record<Exclude<RecordResult["status"], "ok">, HttpError> = {
  not_member: new HttpError("not_found", "You can only invite people to clubs you're in."),
  full: new HttpError("bad_request", "This club is full (50 members), so nobody else can join."),
  too_many: new HttpError("bad_request", "You've sent 10 invitations today. You can send more tomorrow, or share the club code."),
  already_invited: new HttpError("bad_request", "That address was invited to this club in the last week. Share the club code with them instead."),
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["POST"]);
    const user = await deps.requireUser(req);
    await deps.rateLimit(user.id);
    const body = await readJsonBody(req);
    onlyKeys(body, ["clubId", "email"]);
    const clubId = parseUuid(body.clubId, "clubId");
    const email = parseEmail(body.email);
    if (user.email && email === user.email.toLowerCase()) {
      throw new HttpError("bad_request", "That's your own address. Invite someone else.");
    }

    const result = await deps.record(user.id, clubId, await emailHash(clubId, email));
    if (result.status !== "ok") throw REFUSALS[result.status];

    try {
      await deps.send(
        inviteEmail(
          {
            to: email,
            inviterName: result.inviter_name,
            clubName: result.club_name,
            bookTitle: deps.bookTitle(result.volume_id),
            finishesOn: result.finishes_on,
            inviteCode: result.invite_code,
          },
          deps.siteOrigin,
        ),
      );
    } catch (err) {
      console.error("club-invite: sending failed", err);
      await deps.forget(result.invite_id).catch((e) => console.error("club-invite: forgetting the unsent invitation failed", e));
      throw new HttpError("upstream_error", "We couldn't send the invitation. Try again in a few minutes.");
    }
    return json(req, METHODS, { sent: true });
  } catch (err) {
    return errorResponse(req, METHODS, err);
  }
}
