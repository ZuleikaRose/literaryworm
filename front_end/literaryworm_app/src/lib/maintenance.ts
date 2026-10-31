/**
 * Maintenance notices: a banner across the site before and during planned work. Developers and
 * admins write them at /maintenance; the database (maintenance_notices) shows everyone the ones
 * between `announceAt` and `endsAt`. The rules here mirror the table's checks.
 */

export const NOTICE_TITLE_MAX = 80;
export const NOTICE_MESSAGE_MAX = 500;
const DAY = 24 * 60 * 60 * 1000;
/** Work can't run longer than this, and can't be announced further ahead than this. */
export const NOTICE_LONGEST_WORK = 7 * DAY;
export const NOTICE_EARLIEST_ANNOUNCE = 30 * DAY;
/** How often an open page checks for new notices. */
export const NOTICE_REFRESH_MS = 5 * 60 * 1000;

export interface MaintenanceNotice {
  id: string;
  title: string;
  message: string;
  /** Milliseconds since 1970. */
  announceAt: number;
  startsAt: number;
  endsAt: number;
}

export interface NoticeRow {
  id: string;
  title: string;
  message: string;
  announce_at: string;
  starts_at: string;
  ends_at: string;
}

export const toNotice = (r: NoticeRow): MaintenanceNotice => ({
  id: r.id,
  title: r.title,
  message: r.message,
  announceAt: Date.parse(r.announce_at),
  startsAt: Date.parse(r.starts_at),
  endsAt: Date.parse(r.ends_at),
});

export type NoticeState = "scheduled" | "announced" | "under way" | "over";

/** Where a notice is: written but not showing yet, showing ahead of the work, during it, or done. */
export function noticeState(n: MaintenanceNotice, now: number): NoticeState {
  if (now >= n.endsAt) return "over";
  if (now >= n.startsAt) return "under way";
  if (now >= n.announceAt) return "announced";
  return "scheduled";
}

/** The notices to show on the site now, soonest work first. */
export function showingNotices(list: MaintenanceNotice[], now: number): MaintenanceNotice[] {
  return list.filter((n) => n.announceAt <= now && now < n.endsAt).sort((a, b) => a.startsAt - b.startsAt);
}

/** For staff: what's coming or happening first, then the past (newest first). */
export function sortForStaff(list: MaintenanceNotice[], now: number): MaintenanceNotice[] {
  const live = list.filter((n) => n.endsAt > now).sort((a, b) => a.startsAt - b.startsAt);
  const past = list.filter((n) => n.endsAt <= now).sort((a, b) => b.endsAt - a.endsAt);
  return [...live, ...past];
}

export interface NoticeDraft {
  title: string;
  message: string;
  announceAt: number | null;
  startsAt: number | null;
  endsAt: number | null;
}

export type NoticeField = "title" | "message" | "announceAt" | "startsAt" | "endsAt";

/** Each field's problem, the same rules as the table; empty when the draft can be saved. */
export function noticeErrors(d: NoticeDraft, now: number, { isNew }: { isNew: boolean }): Partial<Record<NoticeField, string>> {
  const errors: Partial<Record<NoticeField, string>> = {};
  const title = d.title.trim();
  const message = d.message.trim();
  if (!title) errors.title = "Enter a title, such as Planned update.";
  else if (title.length > NOTICE_TITLE_MAX) errors.title = `Use ${NOTICE_TITLE_MAX} characters or fewer.`;
  if (!message) errors.message = "Say what will happen and what readers should expect.";
  else if (message.length > NOTICE_MESSAGE_MAX) errors.message = `Use ${NOTICE_MESSAGE_MAX} characters or fewer.`;
  if (d.startsAt === null) errors.startsAt = "Choose when the work starts.";
  if (d.endsAt === null) errors.endsAt = "Choose when the work ends.";
  if (d.announceAt === null) errors.announceAt = "Choose when the notice starts showing.";
  if (d.startsAt !== null && d.endsAt !== null) {
    if (d.endsAt <= d.startsAt) errors.endsAt = "End it after it starts.";
    else if (d.endsAt - d.startsAt > NOTICE_LONGEST_WORK) errors.endsAt = "Keep the work to 7 days or less.";
  }
  if (d.announceAt !== null && d.startsAt !== null) {
    if (d.announceAt > d.startsAt) errors.announceAt = "Start showing the notice before (or when) the work starts.";
    else if (d.startsAt - d.announceAt > NOTICE_EARLIEST_ANNOUNCE) errors.announceAt = "Show it at most 30 days ahead.";
  }
  // A new notice for work that's already over would never show.
  if (isNew && d.endsAt !== null && d.endsAt <= now && !errors.endsAt) errors.endsAt = "That time has passed. Choose a time still to come.";
  return errors;
}

/** `datetime-local` input values are in the viewer's own time zone. */
export function fromLocalInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export function toLocalInput(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const sameDay = (a: Date, b: Date, timeZone?: string) => {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "numeric", day: "numeric" });
  return f.format(a) === f.format(b);
};

/**
 * When the work runs, in the reader's time zone with the zone named (Sat 2 Nov, 02:00–02:30 GMT),
 * or across two days (Sat 2 Nov, 23:00 – Sun 3 Nov, 01:00 GMT).
 */
export function noticeWhen(n: Pick<MaintenanceNotice, "startsAt" | "endsAt">, timeZone?: string): string {
  const start = new Date(n.startsAt);
  const end = new Date(n.endsAt);
  const day = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const zone =
    // US English names US zones (EST, PDT); elsewhere it gives an offset (GMT+1), which is still clear.
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(end).find((p) => p.type === "timeZoneName")?.value ?? "";
  // Built from parts: some engines put a comma after the weekday ("Sat, 2 Nov") and some don't.
  const dayText = (d: Date) => {
    const parts = day.formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("weekday")} ${get("day")} ${get("month")}`;
  };
  if (sameDay(start, end, timeZone)) return `${dayText(start)}, ${time.format(start)}–${time.format(end)} ${zone}`.trim();
  return `${dayText(start)}, ${time.format(start)} – ${dayText(end)}, ${time.format(end)} ${zone}`.trim();
}
