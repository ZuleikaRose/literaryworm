// POST /functions/v1/club-digest — called by pg_cron (private.call_club_digest) daily, never by
// the browser. Emails each member who turned on book club post emails the new posts in their
// clubs since they last looked, about chapters they've reached only (the database leaves the rest
// out), one email per account.
//
// The caller must send the secret kept in Vault (Authorization: Bearer …); anything else is
// refused. Accounts are claimed first (account_private.club_posts_emailed_through moves on, so two
// runs can't send twice); one whose email fails is handed back to the time it had.

import { sameSecret } from "../whats-new/handler.ts";
import { type ChapterPosts, clubPostsEmail, type Email } from "./email.ts";

/** One row of claim_club_post_digests(): one account, one club, one chapter. */
export interface DigestRow extends ChapterPosts {
  userId: string;
  email: string;
  name: string | null;
  /** What club_posts_emailed_through was before the claim (ISO), for handing it back. */
  wasThrough: string | null;
}

export interface Deps {
  /** The secret from Vault; null when it's missing (then nothing is sent). */
  secret: () => Promise<string | null>;
  claim: (max: number) => Promise<DigestRow[]>;
  /** Hands an account back, so the next run tries again. */
  release: (userId: string, wasThrough: string | null) => Promise<void>;
  /** The member's one-click unsubscribe link for club post emails. */
  unsubscribeLink: (userId: string) => Promise<string>;
  send: (email: Email, unsubscribe: string) => Promise<void>;
  siteOrigin: string;
}

/** Accounts claimed at a time, and batches in one run; more carry on the next day. */
export const BATCH = 200;
export const MAX_BATCHES = 10;

const reply = (status: number, body: unknown) => Response.json(body, { status });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];

  try {
    const expected = await deps.secret();
    if (!expected || !given || !sameSecret(given, expected)) {
      return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
    }
    let accounts = 0;
    let sent = 0;
    let failed = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const rows = await deps.claim(BATCH);
      const byAccount = new Map<string, DigestRow[]>();
      for (const r of rows) byAccount.set(r.userId, [...(byAccount.get(r.userId) ?? []), r]);
      for (const [userId, mine] of byAccount) {
        accounts += 1;
        try {
          const unsubscribe = await deps.unsubscribeLink(userId);
          await deps.send(clubPostsEmail({ to: mine[0].email, name: mine[0].name, rows: mine, site: deps.siteOrigin, unsubscribe }), unsubscribe);
          sent += 1;
        } catch (err) {
          failed += 1;
          console.error(`club-digest: emailing account ${userId} failed`, err);
          await deps.release(userId, mine[0].wasThrough).catch((e) => console.error(`club-digest: handing back account ${userId} failed`, e));
        }
      }
      if (byAccount.size < BATCH) break;
    }
    return reply(200, { accounts, sent, failed });
  } catch (err) {
    console.error("club-digest: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
