// POST /functions/v1/club-meetings — called by pg_cron (private.call_club_meetings) every 10
// minutes, never by the browser. Emails each member of a book club a reminder in the day before one
// of its meetings, once per meeting, and tells the members (not the owner who did it) when an
// upcoming meeting moves or is cancelled.
//
// The caller must send the secret kept in Vault (Authorization: Bearer …); anything else is
// refused. Meetings are claimed first (club_meetings.reminded_at, and club_meeting_changes.emailed_at
// for changes, so two runs can't send twice); one whose emails all fail is handed back for the next run.

import { sameSecret } from "../whats-new/handler.ts";
import { type Email, type Meeting, type MeetingChange, meetingChangeEmail, meetingReminderEmail } from "./email.ts";

/** One member to remind about one meeting (what claim_club_meeting_reminders() returns). */
export interface Reminder {
  meeting: Meeting;
  userId: string;
  email: string;
  name: string | null;
}

/** One member to tell about one moved or cancelled meeting (what claim_club_meeting_changes() returns). */
export interface ChangeNotice {
  change: MeetingChange;
  userId: string;
  email: string;
  name: string | null;
}

export interface Deps {
  /** The secret from Vault; null when it's missing (then nothing is sent). */
  secret: () => Promise<string | null>;
  claim: (max: number) => Promise<Reminder[]>;
  /** Hands a meeting back, so the next run tries again. */
  release: (meetingId: string) => Promise<void>;
  claimChanges: (max: number) => Promise<ChangeNotice[]>;
  /** Hands a change back, so the next run tries again. */
  releaseChange: (meetingId: string) => Promise<void>;
  /** The member's one-click unsubscribe link for meeting emails. */
  unsubscribeLink: (userId: string) => Promise<string>;
  send: (email: Email, unsubscribe: string) => Promise<void>;
  siteOrigin: string;
}

/** Meetings claimed in one run; more carry on the next run. */
export const BATCH = 100;

const reply = (status: number, body: unknown) => Response.json(body, { status });

/**
 * Sends one email per member, meeting by meeting. Nobody reached about a meeting: it's handed
 * back to try again next run. Some reached: it isn't, so nobody gets it twice.
 */
async function sendAll<T extends { userId: string; email: string }>(
  deps: Deps,
  rows: T[],
  meetingOf: (row: T) => string,
  emailFor: (row: T, unsubscribe: string) => Email,
  handBack: (meetingId: string) => Promise<void>,
  doing: string,
) {
  const byMeeting = new Map<string, T[]>();
  for (const r of rows) byMeeting.set(meetingOf(r), [...(byMeeting.get(meetingOf(r)) ?? []), r]);
  let sent = 0;
  let failed = 0;
  for (const [meetingId, members] of byMeeting) {
    let sentHere = 0;
    for (const r of members) {
      try {
        const unsubscribe = await deps.unsubscribeLink(r.userId);
        await deps.send(emailFor(r, unsubscribe), unsubscribe);
        sentHere += 1;
      } catch (err) {
        failed += 1;
        console.error(`club-meetings: ${doing} account ${r.userId} about meeting ${meetingId} failed`, err);
      }
    }
    sent += sentHere;
    if (sentHere === 0) await handBack(meetingId).catch((e) => console.error(`club-meetings: handing back meeting ${meetingId} failed`, e));
  }
  return { meetings: byMeeting.size, sent, failed };
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];

  try {
    const expected = await deps.secret();
    if (!expected || !given || !sameSecret(given, expected)) {
      return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
    }
    const reminders = await sendAll(
      deps,
      await deps.claim(BATCH),
      (r) => r.meeting.id,
      (r, unsubscribe) => meetingReminderEmail({ to: r.email, name: r.name, meeting: r.meeting, site: deps.siteOrigin, unsubscribe }),
      deps.release,
      "reminding",
    );
    const changes = await sendAll(
      deps,
      await deps.claimChanges(BATCH),
      (c) => c.change.meeting.id,
      (c, unsubscribe) => meetingChangeEmail({ to: c.email, name: c.name, change: c.change, site: deps.siteOrigin, unsubscribe }),
      deps.releaseChange,
      "telling",
    );
    return reply(200, { ...reminders, changes });
  } catch (err) {
    console.error("club-meetings: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
