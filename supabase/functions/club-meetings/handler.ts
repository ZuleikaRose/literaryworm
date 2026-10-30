// POST /functions/v1/club-meetings — called by pg_cron (private.call_club_meetings) every hour,
// never by the browser. Emails each member of a book club a reminder in the day before one of
// its meetings, once per meeting.
//
// The caller must send the secret kept in Vault (Authorization: Bearer …); anything else is
// refused. Meetings are claimed first (club_meetings.reminded_at, so two runs can't send
// twice); a meeting whose emails all fail is handed back for the next hour.

import { sameSecret } from "../whats-new/handler.ts";
import { type Email, type Meeting, meetingReminderEmail } from "./email.ts";

/** One member to remind about one meeting (what claim_club_meeting_reminders() returns). */
export interface Reminder {
  meeting: Meeting;
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
  /** The member's one-click unsubscribe link for these reminders. */
  unsubscribeLink: (userId: string) => Promise<string>;
  send: (email: Email, unsubscribe: string) => Promise<void>;
  siteOrigin: string;
}

/** Meetings claimed in one run; more carry on the next hour. */
export const BATCH = 100;

const reply = (status: number, body: unknown) => Response.json(body, { status });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== "POST") return reply(405, { error: { code: "method_not_allowed", message: "Use POST." } });
  const given = req.headers.get("Authorization")?.match(/^Bearer (.+)$/)?.[1];

  try {
    const expected = await deps.secret();
    if (!expected || !given || !sameSecret(given, expected)) {
      return reply(401, { error: { code: "unauthorized", message: "Not allowed." } });
    }
    const reminders = await deps.claim(BATCH);
    const byMeeting = new Map<string, Reminder[]>();
    for (const r of reminders) byMeeting.set(r.meeting.id, [...(byMeeting.get(r.meeting.id) ?? []), r]);

    let sent = 0;
    let failed = 0;
    for (const [meetingId, members] of byMeeting) {
      let sentHere = 0;
      for (const r of members) {
        try {
          const unsubscribe = await deps.unsubscribeLink(r.userId);
          await deps.send(meetingReminderEmail({ to: r.email, name: r.name, meeting: r.meeting, site: deps.siteOrigin, unsubscribe }), unsubscribe);
          sentHere += 1;
        } catch (err) {
          failed += 1;
          console.error(`club-meetings: reminding account ${r.userId} about meeting ${meetingId} failed`, err);
        }
      }
      sent += sentHere;
      // Nobody reached: try the whole meeting again next hour. Some reached: don't send them a second one.
      if (sentHere === 0) {
        await deps.release(meetingId).catch((e) => console.error(`club-meetings: handing back meeting ${meetingId} failed`, e));
      }
    }
    return reply(200, { meetings: byMeeting.size, sent, failed });
  } catch (err) {
    console.error("club-meetings: run failed", err);
    return reply(500, { error: { code: "server_error", message: "Something went wrong. Try again." } });
  }
}
