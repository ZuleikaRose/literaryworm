// Book club meeting emails: the reminder in the day before a meeting, and the note when one moves
// or is cancelled. Inline styles only (email clients drop <style> blocks), matching
// supabase/templates and the other emails. In the member's email language (_shared/emailI18n.ts);
// the calendar file stays English.

import { CATALOG } from "../_shared/catalog.ts";
import { emailLocale, type EmailLanguage, htmlLang, translator } from "../_shared/emailI18n.ts";

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
  /** A file sent with the email: the updated calendar file when a meeting moves or is cancelled. */
  attachment?: { filename: string; content: string; contentType: string };
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** "Sunday 8 November at 19:00 GMT", in the time zone the meeting was set in (UTC if that's unknown). */
export function meetingTime(startsAt: string, timeZone: string, lang: EmailLanguage = "en"): string {
  const format = (zone: string) => {
    if (lang !== "en") {
      return new Intl.DateTimeFormat(emailLocale(lang), {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: zone,
        timeZoneName: "short",
      }).format(new Date(startsAt));
    }
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
export function meetingLength(minutes: number, lang: EmailLanguage = "en"): string {
  const t = translator(lang);
  return minutes === 60 ? t("1 hour") : minutes === 120 ? t("2 hours") : t("{n} minutes", { n: minutes });
}

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
  lang: EmailLanguage;
}

/** One email in the club meeting layout, as text and HTML. */
function layout(p: Parts): Email {
  const t = translator(p.lang);
  const settings = `${p.site}/account#preferences`;
  const why = t("You're getting this because you're in {club}.", { club: p.clubName });
  const stop = t("Stop meeting emails in one click");
  const change = t("change your email settings");
  // The two links go into the translated sentence after it's escaped.
  const links = escapeHtml(t("{stop} or {change}.", { stop: "\u0001", change: "\u0002" }))
    .replace("\u0001", `<a href="${escapeHtml(p.unsubscribe)}" style="color:#a24e2f;">${escapeHtml(stop)}</a>`)
    .replace("\u0002", `<a href="${escapeHtml(settings)}" style="color:#a24e2f;">${escapeHtml(change)}</a>`);
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
    `${why} ${t("Stop meeting emails in one click: {link}", { link: p.unsubscribe })}`,
    t("Or change your email settings: {link}", { link: settings }),
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const html = `<!doctype html>
<html ${htmlLang(p.lang)}>
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
                  <a href="${escapeHtml(p.page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(t("Open the club"))}</a>
                </p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:#5b5750;">${escapeHtml(p.pageHint)}.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                ${escapeHtml(why)} ${links}<br />
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

export function meetingReminderEmail(input: {
  to: string;
  name: string | null;
  meeting: Meeting;
  site: string;
  unsubscribe: string;
  language?: EmailLanguage;
}): Email {
  const lang = input.language ?? "en";
  const t = translator(lang);
  const m = input.meeting;
  const book = CATALOG[m.bookId]?.title ?? t("your book");
  const when = meetingTime(m.startsAt, m.timeZone, lang);
  return layout({
    to: input.to,
    subject: t("{club} meets {when}", { club: m.clubName, when }),
    heading: t("{club} meets soon", { club: m.clubName }),
    hello: input.name ? t("Hi {name},", { name: input.name }) : t("Hi,"),
    lead: t("A reminder that {club} meets soon to talk about {book}.", { club: m.clubName, book }),
    card: [m.title, t("{when}, for {length}", { when, length: meetingLength(m.minutes, lang) }), ...(m.note ? [m.note] : [])],
    page: `${input.site}/clubs/${m.clubId}`,
    pageHint: t("Open the club, catch up on the discussion and add the meeting to your calendar"),
    clubName: m.clubName,
    unsubscribe: input.unsubscribe,
    site: input.site,
    lang,
  });
}

/** A meeting that moved (startsAt is the new time) or was cancelled, and the time members knew. */
export interface MeetingChange {
  kind: "moved" | "cancelled";
  meeting: Meeting;
  /** ISO, UTC: the time members were told before. */
  wasStartsAt: string;
}

/** 2026-11-08T19:00:00.000Z → 20261108T190000Z, as calendars write times. */
export const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escapes text for a calendar file (RFC 5545): backslashes, commas, semicolons and line breaks. */
export const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a line to 75 characters, continuing with a space, as calendar files must. */
export function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

/**
 * The meeting's calendar file after a change: the same event as the club page's Add to calendar
 * (UID `<meeting id>@literaryworm.com`, as meetingIcs() in src/lib/clubCalendar.ts writes it) with a
 * later SEQUENCE (minutes since 1970, like the app's), so opening it moves the event; a cancelled
 * meeting's file cancels it (METHOD:CANCEL, STATUS:CANCELLED).
 */
export function meetingChangeIcs(change: MeetingChange, site: string, now = new Date()): string {
  const m = change.meeting;
  const start = new Date(m.startsAt);
  const end = new Date(start.getTime() + m.minutes * 60_000);
  const url = `${site}/clubs/${m.clubId}`;
  const book = CATALOG[m.bookId]?.title ?? "your book";
  const cancelled = change.kind === "cancelled";
  const description = [`${m.clubName} is reading ${book}.`, m.note ?? "", `Open the club: ${url}`].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LiteraryWorm//Book club meetings//EN",
    "CALSCALE:GREGORIAN",
    cancelled ? "METHOD:CANCEL" : "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${m.id}@literaryworm.com`,
    `SEQUENCE:${Math.floor(now.getTime() / 60_000)}`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(`${cancelled ? "Cancelled: " : ""}${m.clubName}: ${m.title}`)}`,
    `DESCRIPTION:${icsText(description)}`,
    `URL:${url}`,
    cancelled ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    ...(cancelled ? [] : ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(`${m.clubName} meets soon`)}`, "TRIGGER:-PT30M", "END:VALARM"]),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** The calendar file's name: the club and the day, like meetingFileName() in the app. */
export function meetingFileName(clubName: string, startsAt: string): string {
  const slug = clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book-club";
  return `${slug}-${startsAt.slice(0, 10)}.ics`;
}

export function meetingChangeEmail(
  input: { to: string; name: string | null; change: MeetingChange; site: string; unsubscribe: string; language?: EmailLanguage },
  now = new Date(),
): Email {
  const lang = input.language ?? "en";
  const t = translator(lang);
  const { kind, meeting: m } = input.change;
  const was = meetingTime(input.change.wasStartsAt, m.timeZone, lang);
  const when = meetingTime(m.startsAt, m.timeZone, lang);
  const moved = kind === "moved";
  const email = layout({
    to: input.to,
    subject: moved ? t("{club}: meeting moved to {when}", { club: m.clubName, when }) : t("{club}: meeting on {was} cancelled", { club: m.clubName, was }),
    heading: moved ? t("A club meeting has moved") : t("A club meeting is cancelled"),
    hello: input.name ? t("Hi {name},", { name: input.name }) : t("Hi,"),
    lead: moved
      ? t("The {club} meeting \"{title}\" has moved. It was {was}.", { club: m.clubName, title: m.title, was })
      : t("The {club} meeting \"{title}\" on {was} won't go ahead.", { club: m.clubName, title: m.title, was }),
    card: moved
      ? [m.title, t("Now {when}, for {length}", { when, length: meetingLength(m.minutes, lang) }), t("Was {was}", { was }), ...(m.note ? [m.note] : [])]
      : [m.title, t("Cancelled: was {was}", { was })],
    page: `${input.site}/clubs/${m.clubId}`,
    pageHint: moved
      ? t("Open the attached calendar file to move it in your calendar, or open the club to say whether you can still come")
      : t("Open the attached calendar file to take it out of your calendar, or open the club to see its other meetings"),
    clubName: m.clubName,
    unsubscribe: input.unsubscribe,
    site: input.site,
    lang,
  });
  return {
    ...email,
    attachment: {
      filename: meetingFileName(m.clubName, m.startsAt),
      content: meetingChangeIcs(input.change, input.site, now),
      contentType: `text/calendar; charset=utf-8; method=${moved ? "PUBLISH" : "CANCEL"}`,
    },
  };
}
