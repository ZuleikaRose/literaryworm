import { isTime, minutesOf } from "./bedtime";
import { SLEEP_MINUTES } from "./reading";

/**
 * Bedtime listening (components/BedtimeView.tsx, /listen/:id?view=bedtime): a dim, quiet view of
 * the player for winding down. It starts a sleep timer when none is set, the end of the chapter when
 * that's near, else BEDTIME_MINUTES; the timer fades the volume out (sleepVolume() in lib/reading.ts)
 * and nothing keeps the screen awake. Kids profiles are nudged towards it before their bedtime.
 */

/** The end of the chapter is the stop when it's at most this far off, in listening time. */
export const BEDTIME_CHAPTER_MAX_SECONDS = 20 * 60;
/** Otherwise the timer runs this long (one of the sleep timer's own choices). */
export const BEDTIME_MINUTES = 15;
/** A Kids profile's player suggests bedtime listening this long before its bedtime. */
export const BEDTIME_NUDGE_MINUTES = 45;

/** The sleep timer to start with, as the player's sleep select writes it: "chapter" or minutes. */
export function bedtimeTimer(chapterSecondsLeft: number, speed: number): string {
  const listening = chapterSecondsLeft / Math.max(speed, 0.25);
  return listening > 0 && listening <= BEDTIME_CHAPTER_MAX_SECONDS ? "chapter" : String(BEDTIME_MINUTES);
}

/** Whether a bedtime ("HH:MM", the device's clock) is coming up within `within` minutes of `now`. */
export function nearBedtime(now: Date, bedtime: string | null | undefined, within = BEDTIME_NUDGE_MINUTES): boolean {
  if (!isTime(bedtime)) return false;
  const until = (minutesOf(bedtime) - (now.getHours() * 60 + now.getMinutes()) + 24 * 60) % (24 * 60);
  return until > 0 && until <= within;
}

// BEDTIME_MINUTES must be a choice the sleep timer offers.
if (!SLEEP_MINUTES.includes(BEDTIME_MINUTES)) throw new Error("BEDTIME_MINUTES isn't a sleep timer choice");
