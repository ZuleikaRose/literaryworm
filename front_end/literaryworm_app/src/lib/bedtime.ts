import type { Profile } from "../types";

/**
 * Bedtime for Kids profiles: a grown-up picks a bedtime and a wake-up time in the profile editor
 * (manage-profile `set_bedtime`, with the account password; `reader_profiles.bedtime` and
 * `wake_time`, migration 6606). Between them, on the device's own clock, the reader and the player
 * show *Time for bed* instead of the book; a grown-up's password allows 15 more minutes
 * (`TimeUsed.bedtimeExtraUntil`, in memory). Times are "HH:MM", 24-hour.
 */
export const BEDTIME_OPTIONS = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"] as const;
export const WAKE_OPTIONS = ["06:00", "06:30", "07:00", "07:30", "08:00"] as const;
export const DEFAULT_WAKE = "07:00";
export const BEDTIME_EXTRA_MINUTES = 15;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const isTime = (value: unknown): value is string => typeof value === "string" && TIME.test(value);

/** Minutes after midnight. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** "20:30" as "8:30pm", "07:00" as "7am". */
export function timeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

/** Whether `now` (the device's clock) is between bedtime and wake-up; overnight when bedtime is later. */
export function inBedtime(now: Date, bedtime: string, wake: string): boolean {
  const at = now.getHours() * 60 + now.getMinutes();
  const from = minutesOf(bedtime);
  const to = minutesOf(wake);
  if (from === to) return false;
  return from > to ? at >= from || at < to : at >= from && at < to;
}

/** When the profile may read again: the next wake-up time after `now`. */
export function wakesAt(now: Date, wake: string): Date {
  const next = new Date(now);
  next.setHours(Math.floor(minutesOf(wake) / 60), minutesOf(wake) % 60, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

/** True while a Kids profile with a bedtime should be in bed (and no grown-up allowed more). */
export function bedtimeNow(profile: Pick<Profile, "ageRating" | "bedtime" | "wakeTime"> | null | undefined, now: Date, extraUntil = 0): boolean {
  if (!profile || profile.ageRating !== "kids" || !profile.bedtime || !profile.wakeTime) return false;
  if (extraUntil > now.getTime()) return false;
  return inBedtime(now, profile.bedtime, profile.wakeTime);
}

/** Milliseconds until the next bedtime starts or ends, so a screen can check again then (at most a minute). */
export function nextCheckMs(now: Date): number {
  return 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50;
}
