import { describe, expect, it } from "@jest/globals";
import { type ClubMeeting, icsText, meetingError, meetingFileName, meetingIcs, meetingStart, upcomingMeetings } from "./clubCalendar";

const meeting: ClubMeeting = {
  id: "11111111-1111-4111-8111-111111111111",
  clubId: "club-1",
  startsAt: "2026-11-08T19:00:00.000Z",
  minutes: 90,
  title: "Chapters 1 to 10",
  note: "Bring tea; we'll start, then chat.",
  timeZone: "Europe/London",
};

describe("checking a new meeting", () => {
  const now = new Date(2026, 9, 30, 12);
  const input = { title: "Chapters 1 to 10", date: "2026-11-08", time: "19:00", minutes: 60, note: "" };

  it("accepts a named meeting still to come", () => {
    expect(meetingError(input, now)).toBeNull();
  });

  it("says what's wrong in plain words", () => {
    expect(meetingError({ ...input, title: "  " }, now)).toMatch(/Give the meeting a name/);
    expect(meetingError({ ...input, title: "x".repeat(81) }, now)).toMatch(/80 characters/);
    expect(meetingError({ ...input, date: "" }, now)).toBe("Choose a date and a time.");
    expect(meetingError({ ...input, date: "2026-10-29" }, now)).toBe("Choose a time that's still to come.");
    expect(meetingError({ ...input, date: "2028-01-01" }, now)).toBe("Meetings can be set up to a year ahead.");
    expect(meetingError({ ...input, minutes: 10 }, now)).toBe("Choose how long it runs.");
    expect(meetingError({ ...input, note: "x".repeat(501) }, now)).toMatch(/500 characters/);
  });

  it("reads the typed date and time as local time", () => {
    expect(meetingStart("2026-11-08", "19:00")?.getHours()).toBe(19);
    expect(meetingStart("2026-11-08", "7pm")).toBeNull();
  });
});

describe("upcoming meetings", () => {
  it("keeps the ones not yet over, soonest first", () => {
    const later = { ...meeting, id: "b", startsAt: "2026-12-01T19:00:00.000Z" };
    const over = { ...meeting, id: "c", startsAt: "2026-10-01T19:00:00.000Z" };
    // Under way: started 30 minutes ago, runs 90.
    const now = new Date("2026-11-08T19:30:00.000Z");
    expect(upcomingMeetings([later, over, meeting], now).map((m) => m.id)).toEqual([meeting.id, "b"]);
  });
});

describe("the calendar file", () => {
  const ics = meetingIcs(meeting, { clubName: "Sunday Classics", bookTitle: "Pride and Prejudice", url: "https://www.literaryworm.com/clubs/club-1" }, new Date("2026-10-30T12:00:00Z"));

  it("is one event with the right times, in UTC, ending lines with CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261108T190000Z\r\n");
    expect(ics).toContain("DTEND:20261108T203000Z\r\n");
    expect(ics).toContain(`UID:${meeting.id}@literaryworm.com\r\n`);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "").includes("\n")).toBe(false);
  });

  it("escapes text and folds long lines", () => {
    expect(icsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    expect(ics).toContain("SUMMARY:Sunday Classics: Chapters 1 to 10");
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
    // Folded lines continue with a space; unfolded, the note is whole.
    expect(ics.replace(/\r\n /g, "")).toContain("Bring tea\\; we'll start\\, then chat.");
  });

  it("is named after the club and the day", () => {
    expect(meetingFileName("Sunday Classics!", meeting.startsAt)).toBe("sunday-classics-2026-11-08.ics");
  });
});
