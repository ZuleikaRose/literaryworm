// A book club's meetings as a calendar feed (an .ics file calendar apps subscribe to), and the
// signed links that reach it. A link's token is "<club id>.<member id>.<64 hex>": an HMAC-SHA256
// of both ids, signed with the club_calendar_secret kept in Vault, so it works without signing in
// but only for that club and member, and can't be made up. Like the unsubscribe links
// (_shared/unsubscribe.ts), nothing is stored for it.

import { CATALOG } from "../_shared/catalog.ts";
import { fold, icsText, icsTime } from "../club-meetings/email.ts";

const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function sign(clubId: string, userId: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(`club-calendar:${clubId}:${userId}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function feedToken(clubId: string, userId: string, key: string): Promise<string> {
  return `${clubId}.${userId}.${await sign(clubId, userId, key)}`;
}

/** The club and member a token is for, or null when it's malformed or the signature doesn't match. */
export async function checkFeedToken(token: unknown, key: string): Promise<{ clubId: string; userId: string } | null> {
  if (typeof token !== "string" || token.length > 160) return null;
  const [clubId, userId, given, extra] = token.split(".");
  if (extra !== undefined || !clubId || !userId || !given || !UUID.test(clubId) || !UUID.test(userId) || !/^[0-9a-f]{64}$/.test(given)) return null;
  const expected = await sign(clubId, userId, key);
  // Compared in time that doesn't depend on where the strings differ.
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0 ? { clubId, userId } : null;
}

export interface FeedClub {
  id: string;
  name: string;
  volumeId: string;
}

export interface FeedMeeting {
  id: string;
  startsAt: string;
  minutes: number;
  title: string;
  note: string | null;
}

/**
 * The club's meetings as one calendar. Each event has the same UID as Add to calendar's file and
 * the change emails' (meetingIcs() in the app, meetingChangeIcs()), and SEQUENCE in minutes since
 * 1970, so whichever a member added, the newest wins. A cancelled meeting is simply left out:
 * subscribed calendars drop it at their next refresh.
 */
export function clubFeed(club: FeedClub, meetings: FeedMeeting[], site: string, now = new Date()): string {
  const url = `${site}/clubs/${club.id}`;
  const book = CATALOG[club.volumeId]?.title ?? "your book";
  const events = meetings.flatMap((m) => {
    const start = new Date(m.startsAt);
    const end = new Date(start.getTime() + m.minutes * 60_000);
    const description = [`${club.name} is reading ${book}.`, m.note ?? "", `Open the club: ${url}`].filter(Boolean).join("\n\n");
    return [
      "BEGIN:VEVENT",
      `UID:${m.id}@literaryworm.com`,
      `SEQUENCE:${Math.floor(now.getTime() / 60_000)}`,
      `DTSTAMP:${icsTime(now)}`,
      `DTSTART:${icsTime(start)}`,
      `DTEND:${icsTime(end)}`,
      `SUMMARY:${icsText(`${club.name}: ${m.title}`)}`,
      `DESCRIPTION:${icsText(description)}`,
      `URL:${url}`,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(`${club.name} meets soon`)}`,
      "TRIGGER:-PT30M",
      "END:VALARM",
      "END:VEVENT",
    ];
  });
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LiteraryWorm//Book club meetings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(`${club.name} (LiteraryWorm)`)}`,
    // How often calendar apps should look again (some ignore it and pick their own).
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events,
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
