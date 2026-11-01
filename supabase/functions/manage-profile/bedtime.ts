import { HttpError } from "../_shared/http.ts";

// The same choices as src/lib/bedtime.ts.
export const BEDTIMES = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"];
export const WAKE_TIMES = ["06:00", "06:30", "07:00", "07:30", "08:00"];

/** A bedtime and wake-up time from the lists, or both null (no bedtime). */
export function parseBedtime(bedtime: unknown, wakeTime: unknown): { bedtime: string | null; wakeTime: string | null } {
  if (bedtime === null && wakeTime === null) return { bedtime: null, wakeTime: null };
  if (typeof bedtime !== "string" || !BEDTIMES.includes(bedtime)) throw new HttpError("bad_request", "Pick one of the bedtimes.");
  if (typeof wakeTime !== "string" || !WAKE_TIMES.includes(wakeTime)) throw new HttpError("bad_request", "Pick one of the wake-up times.");
  return { bedtime, wakeTime };
}
