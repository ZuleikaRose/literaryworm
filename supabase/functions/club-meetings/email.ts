// Book club meeting emails: the reminder in the day before a meeting, and the note when one moves
// or is cancelled. Inline styles only (email clients drop <style> blocks), matching
// supabase/templates and the other emails.

import { CATALOG } from "../_shared/catalog.ts";

export interface Meeting {
  id: string;
  clubId: string;
  clubName: string;
  /** The club's book: a catalog id. */
  bookId: string;
  title: string;
  note: string | null;
  /** ISO, UTC. */
  startsAt: string;
  minutes: number;
  /** The time zone the owner scheduled it in (IANA). */
  timeZone: string;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** "Sunday 8 November at 19:00 GMT", in the time zone the meeting was set in (UTC if that's unknown). */
export function meetingTime(startsAt: string, timeZone: string): string {
  const format = (zone: string) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: zone,
      timeZoneName: "short",
    }).formatToParts(new Date(startsAt));
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    // British names (BST, CEST) where there are some; else American ones (EDT) over a bare GMT-4.
    let zoneName = part("timeZoneName");
    if (/^GMT[+-]/.test(zoneName)) {
      zoneName =
        new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(new Date(startsAt)).find((p) => p.type === "timeZoneName")
          ?.value ?? zoneName;
    }
    return `${part("weekday")} ${part("day")} ${part("month")} at ${part("hour")}:${part("minute")} ${zoneName}`;
  };
  try {
    return format(timeZone);
  } catch {
    return format("UTC");
  }
}

/** "1 hour", "90 minutes". */
export const meetingLength = (minutes: number) => (minutes === 60 ? "1 hour" : minutes === 120 ? "2 hours" : `${minutes} minutes`);

interface Parts {
  to: string;
  subject: string;
  heading: string;
  hello: string;
  lead: string;
  /** The meeting card's lines: a bold first line, then plain ones. */
  card: string[];
  page: string;
  pageHint: string;
  clubName: string;
  unsubscribe: string;
  site: string;
}

/** One email in the club meeting layout, as text and HTML. */
function layout(p: Parts): Email {
  const settings = `${p.site}/account#preferences`;
  const [cardTitle, ...cardLines] = p.card;
  const text = [
    p.hello,
    "",
    p.lead,
    "",
    ...p.card,
    "",
    `${p.pageHint}: ${p.page}`,
    "",
    `You're getting this because you're in ${p.clubName}. Stop meeting emails in one click: ${p.unsubscribe}`,
    `Or change your email settings: ${settings}`,
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(p.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1e4cb;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(p.lead)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1e4cb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf8f2;border:1px solid #e0d9cc;border-radius:14px;">
            <tr>
              <td style="padding:32px 32px 8px;${FONT}font-size:20px;font-weight:700;color:#1d1c1a;">
                Literary<span style="color:#a24e2f;">Worm</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;${FONT}color:#1d1c1a;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">${escapeHtml(p.heading)}</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(p.hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(p.lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;border-bottom:1px solid #e0d9cc;${FONT}">
                      <div style="font-size:17px;font-weight:700;color:#1d1c1a;">${escapeHtml(cardTitle)}</div>
                      ${cardLines.map((l) => `<div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(l)}</div>`).join("\n                      ")}
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(p.page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Open the club</a>
                </p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:#5b5750;">${escapeHtml(p.pageHint)}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                You're getting this because you're in ${escapeHtml(p.clubName)}. <a href="${escapeHtml(p.unsubscribe)}" style="color:#a24e2f;">Stop meeting emails in one click</a> or <a href="${escapeHtml(settings)}" style="color:#a24e2f;">change your email settings</a>.<br />
                LiteraryWorm · <a href="https://www.literaryworm.com" style="color:#a24e2f;">www.literaryworm.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  return { to: p.to, subject: p.subject, text, html };
}

export function meetingReminderEmail(input: { to: string; name: string | null; meeting: Meeting; site: string; unsubscribe: string }): Email {
  const m = input.meeting;
  const book = CATALOG[m.bookId]?.title ?? "your book";
  const when = meetingTime(m.startsAt, m.timeZone);
  return layout({
    to: input.to,
    subject: `${m.clubName} meets ${when}`,
    heading: `${m.clubName} meets soon`,
    hello: input.name ? `Hi ${input.name},` : "Hi,",
    lead: `A reminder that ${m.clubName} meets soon to talk about ${book}.`,
    card: [m.title, `${when}, for ${meetingLength(m.minutes)}`, ...(m.note ? [m.note] : [])],
    page: `${input.site}/clubs/${m.clubId}`,
    pageHint: "Open the club, catch up on the discussion and add the meeting to your calendar",
    clubName: m.clubName,
    unsubscribe: input.unsubscribe,
    site: input.site,
  });
}

/** A meeting that moved (startsAt is the new time) or was cancelled, and the time members knew. */
export interface MeetingChange {
  kind: "moved" | "cancelled";
  meeting: Meeting;
  /** ISO, UTC: the time members were told before. */
  wasStartsAt: string;
}

export function meetingChangeEmail(input: { to: string; name: string | null; change: MeetingChange; site: string; unsubscribe: string }): Email {
  const { kind, meeting: m } = input.change;
  const was = meetingTime(input.change.wasStartsAt, m.timeZone);
  const when = meetingTime(m.startsAt, m.timeZone);
  const moved = kind === "moved";
  return layout({
    to: input.to,
    subject: moved ? `${m.clubName}: meeting moved to ${when}` : `${m.clubName}: meeting on ${was} cancelled`,
    heading: moved ? "A club meeting has moved" : "A club meeting is cancelled",
    hello: input.name ? `Hi ${input.name},` : "Hi,",
    lead: moved
      ? `The ${m.clubName} meeting "${m.title}" has moved. It was ${was}.`
      : `The ${m.clubName} meeting "${m.title}" on ${was} won't go ahead.`,
    card: moved
      ? [m.title, `Now ${when}, for ${meetingLength(m.minutes)}`, `Was ${was}`, ...(m.note ? [m.note] : [])]
      : [m.title, `Cancelled: was ${was}`],
    page: `${input.site}/clubs/${m.clubId}`,
    pageHint: moved
      ? "Open the club to say whether you can still come, and add the new time to your calendar"
      : "Open the club to see its other meetings, and take this one out of your calendar",
    clubName: m.clubName,
    unsubscribe: input.unsubscribe,
    site: input.site,
  });
}
