/** Book club meetings: the checks the database makes, and the calendar file for Add to calendar. */

export interface ClubMeeting {
  id: string;
  clubId: string;
  /** When it starts (ISO, UTC). */
  startsAt: string;
  /** How long it runs, in minutes. */
  minutes: number;
  title: string;
  note: string | null;
  /** The time zone it was scheduled in (IANA), so the reminder email gives the right time. */
  timeZone: string;
}

/** The same limits as the database. */
export const MEETING_TITLE_MAX = 80;
export const MEETING_NOTE_MAX = 500;
export const MEETING_LENGTHS = [30, 45, 60, 90, 120] as const;
/** Upcoming meetings a club may have at once. */
export const MEETINGS_MAX = 20;
/** How far ahead a meeting can be set, in days. */
export const MEETING_DAYS_AHEAD = 366;

export interface MeetingInput {
  title: string;
  /** Local date (YYYY-MM-DD) and time (HH:MM) as the owner typed them. */
  date: string;
  time: string;
  minutes: number;
  note: string;
}

/** The start of a meeting typed as a local date and time, or null when they aren't real. */
export function meetingStart(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const start = new Date(`${date}T${time}`);
  return Number.isNaN(start.getTime()) ? null : start;
}

/** A plain-words problem with a new meeting, or null when it can be saved. */
export function meetingError(input: MeetingInput, now = new Date()): string | null {
  const title = input.title.trim();
  if (!title) return "Give the meeting a name, such as Chapters 1 to 10.";
  if (title.length > MEETING_TITLE_MAX) return `Keep the name to ${MEETING_TITLE_MAX} characters.`;
  const start = meetingStart(input.date, input.time);
  if (!start) return "Choose a date and a time.";
  if (start.getTime() <= now.getTime()) return "Choose a time that's still to come.";
  if (start.getTime() > now.getTime() + MEETING_DAYS_AHEAD * 86_400_000) return "Meetings can be set up to a year ahead.";
  if (!(MEETING_LENGTHS as readonly number[]).includes(input.minutes)) return "Choose how long it runs.";
  if (input.note.trim().length > MEETING_NOTE_MAX) return `Keep the note to ${MEETING_NOTE_MAX} characters.`;
  return null;
}

/** Meetings still to come (or under way), soonest first. */
export function upcomingMeetings(meetings: ClubMeeting[], now = new Date()): ClubMeeting[] {
  return meetings
    .filter((m) => Date.parse(m.startsAt) + m.minutes * 60_000 > now.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** 2026-11-08T19:00:00.000Z → 20261108T190000Z, as calendars write times. */
const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Escapes text for a calendar file (RFC 5545): backslashes, commas, semicolons and line breaks. */
export const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Folds a line to 75 characters, continuing with a space, as calendar files must. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    parts.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

/** The meeting as a calendar file (.ics), for Add to calendar. */
export function meetingIcs(meeting: ClubMeeting, about: { clubName: string; bookTitle: string; url: string }, now = new Date()): string {
  const start = new Date(meeting.startsAt);
  const end = new Date(start.getTime() + meeting.minutes * 60_000);
  const description = [`${about.clubName} is reading ${about.bookTitle}.`, meeting.note ?? "", `Open the club: ${about.url}`].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LiteraryWorm//Book club meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@literaryworm.com`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsText(`${about.clubName}: ${meeting.title}`)}`,
    `DESCRIPTION:${icsText(description)}`,
    `URL:${about.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(`${about.clubName} meets soon`)}`,
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** A file name for the meeting's calendar file: the club and the day. */
export function meetingFileName(clubName: string, startsAt: string): string {
  const slug = clubName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "book-club";
  return `${slug}-${startsAt.slice(0, 10)}.ics`;
}
