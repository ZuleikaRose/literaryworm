// /functions/v1/club-calendar — a book club's meetings as a calendar feed.
//
//   POST { clubId }  (signed in, a member of the club)  → { url }: the member's subscribe link.
//   GET ?t=<token>   (calendar apps; no sign-in)         → text/calendar: the club's meetings from
//                                                          30 days ago on.
//
// The token is signed with the key kept in Vault (feed.ts). Every GET checks the member still
// belongs to the club: someone who leaves stops getting its meetings (their calendar app sees 404).
// Deployed with JWT verification off, since calendar apps send no Supabase token; POST checks the
// session itself. Kids profiles never see clubs, so the app never asks for one there.

import { preflight } from "../_shared/cors.ts";
import { errorResponse, HttpError, json, readJsonBody, requireMethod } from "../_shared/http.ts";
import { onlyKeys, parseUuid } from "../_shared/validate.ts";
import { checkFeedToken, clubFeed, type FeedClub, type FeedMeeting, feedToken } from "./feed.ts";

const METHODS = "GET, POST";

export interface Deps {
  requireUser: (req: Request) => Promise<{ id: string }>;
  rateLimit: (key: string) => Promise<void>;
  /** The signing key from Vault; null when it's missing (then no link works). */
  key: () => Promise<string | null>;
  isMember: (clubId: string, userId: string) => Promise<boolean>;
  club: (clubId: string) => Promise<FeedClub | null>;
  /** The club's meetings starting after `since`, soonest first. */
  meetings: (clubId: string, since: Date) => Promise<FeedMeeting[]>;
  /** This function's public address, such as https://<project>.supabase.co/functions/v1/club-calendar. */
  feedBase: string;
  siteOrigin: string;
  now?: () => Date;
}

const notFound = () => new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const early = preflight(req, METHODS);
  if (early) return early;

  try {
    requireMethod(req, ["GET", "POST"]);
    const key = await deps.key();
    if (!key) throw new Error("club_calendar_secret is missing from Vault");

    if (req.method === "POST") {
      const user = await deps.requireUser(req);
      await deps.rateLimit(`club-calendar:link:${user.id}`);
      const body = await readJsonBody(req);
      onlyKeys(body, ["clubId"]);
      const clubId = parseUuid(body.clubId, "clubId");
      if (!(await deps.isMember(clubId, user.id))) throw new HttpError("not_found", "Club not found.");
      return json(req, METHODS, { url: `${deps.feedBase}?t=${await feedToken(clubId, user.id, key)}` });
    }

    // GET: a calendar app. Plain answers, no CORS (nothing in the browser reads it).
    const found = await checkFeedToken(new URL(req.url).searchParams.get("t"), key);
    if (!found) return notFound();
    await deps.rateLimit(`club-calendar:feed:${found.userId}`);
    if (!(await deps.isMember(found.clubId, found.userId))) return notFound();
    const club = await deps.club(found.clubId);
    if (!club) return notFound();
    const now = deps.now?.() ?? new Date();
    const meetings = await deps.meetings(club.id, new Date(now.getTime() - 30 * 86_400_000));
    return new Response(clubFeed(club, meetings, deps.siteOrigin, now), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="club-meetings.ics"',
        "Cache-Control": "private, max-age=900",
      },
    });
  } catch (err) {
    if (req.method === "GET" && !(err instanceof HttpError)) {
      console.error("club-calendar: feed failed", err);
      return new Response("Something went wrong. Try again later.", { status: 500 });
    }
    if (req.method === "GET" && err instanceof HttpError && err.code === "rate_limited") {
      return new Response("Too many requests.", { status: 429, headers: { "Retry-After": "3600" } });
    }
    return errorResponse(req, METHODS, err);
  }
}
