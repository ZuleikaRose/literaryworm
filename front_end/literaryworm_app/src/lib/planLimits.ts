import { planById } from "../data/plans";
import type { PlanId, ReadingDay } from "../types";

/**
 * The plan limits shown on the plan cards: hours of listening a month for the whole account,
 * and how many devices may keep books with Read offline. The database has the same numbers
 * (public.plans) and checks the devices itself (claim_offline_device()). An account without a
 * plan gets Basic's limits.
 */
export function planLimits(planId: PlanId | null): { audioSeconds: number | null; offlineDevices: number } {
  const plan = planById.get(planId ?? "basic") ?? planById.get("basic")!;
  return {
    audioSeconds: plan.audioHoursPerMonth === null ? null : plan.audioHoursPerMonth * 3600,
    offlineDevices: plan.offlineDevices,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The month `day` (YYYY-MM-DD, local, like reading days) is in, as its first and last days. */
export function monthRange(day: string): { from: string; to: string } {
  const [y, m] = day.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

/** The first day of the month after `day`'s, for "Listening starts again on 1 December". */
export function nextMonthLabel(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return new Date(y, m, 1).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
}

/** Seconds every profile listened in the month `day` is in. */
export function listenedThisMonth(profiles: Record<string, ReadingDay>[], day: string): number {
  const { from, to } = monthRange(day);
  let seconds = 0;
  for (const days of profiles) {
    for (const [d, r] of Object.entries(days)) {
      if (d >= from && d <= to) seconds += r.listened ?? 0;
    }
  }
  return seconds;
}

/**
 * The account's listening this month, from a count saved on the server (every device) taken
 * when `localAtCheck` was this device's own count, plus what this device has listened since.
 * The larger of the two counts at the check is used, so time not yet saved isn't lost.
 */
export function listenedSoFar(serverAtCheck: number, localAtCheck: number, localNow: number): number {
  return Math.max(serverAtCheck, localAtCheck) + Math.max(0, localNow - localAtCheck);
}

/** Seconds of listening left this month, or null for unlimited. */
export function listeningLeft(planId: PlanId | null, listened: number): number | null {
  const { audioSeconds } = planLimits(planId);
  return audioSeconds === null ? null : Math.max(0, audioSeconds - listened);
}
