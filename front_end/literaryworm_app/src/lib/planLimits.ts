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

/** The share of the month's listening at which the bell gives a heads-up. */
export const LISTENING_ALERT_SHARE = 0.8;

export interface ListeningAlert {
  /** Seconds listened this month by the household, and the plan's limit. */
  used: number;
  limit: number;
  /** When the household passed the alert share (an estimate: the start of that day, or for today, how long ago). */
  crossedAt: number;
}

/**
 * The bell's heads-up when the household has used most of the month's listening (Basic and
 * Standard only), or null. Worked out from the profiles' reading days.
 */
export function listeningAlert(planId: PlanId | null, profiles: Record<string, ReadingDay>[], now = new Date()): ListeningAlert | null {
  const { audioSeconds } = planLimits(planId);
  if (audioSeconds === null) return null;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const day = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const { from, to } = monthRange(day);
  const byDay = new Map<string, number>();
  for (const days of profiles) {
    for (const [d, r] of Object.entries(days)) {
      if (d >= from && d <= to && r.listened) byDay.set(d, (byDay.get(d) ?? 0) + r.listened);
    }
  }
  const threshold = audioSeconds * LISTENING_ALERT_SHARE;
  let used = 0;
  let crossedOn: string | null = null;
  for (const d of [...byDay.keys()].sort()) {
    used += byDay.get(d)!;
    if (crossedOn === null && used >= threshold) crossedOn = d;
  }
  if (crossedOn === null) return null;
  // Listening happens as it's counted, so today's crossing was as long ago as the time listened since.
  const crossedAt =
    crossedOn === day ? now.getTime() - (used - threshold) * 1000 : new Date(Number(crossedOn.slice(0, 4)), Number(crossedOn.slice(5, 7)) - 1, Number(crossedOn.slice(8, 10))).getTime();
  return { used, limit: audioSeconds, crossedAt };
}

/** "2 h 10 min", "45 min", "5 h". */
export function hoursAndMinutes(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}
