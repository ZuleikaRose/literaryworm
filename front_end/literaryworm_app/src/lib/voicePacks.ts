import { CHARACTERS_PER_HOUR } from "./naturalVoice";

/**
 * More natural-voice hours (Account → This month): packs of 5 or 10 hours, paid once on Stripe
 * Checkout, used only after the plan's monthly hours, and lasting 12 months. VOICE_PACKS in
 * supabase/functions/_shared/stripe.ts has the same prices (voicePacks.test.ts checks).
 */
export const VOICE_PACKS = { 5: 1499, 10: 2499 } as const;
export type VoicePackHours = keyof typeof VOICE_PACKS;
export const VOICE_PACK_HOURS: VoicePackHours[] = [5, 10];
/** How long a pack lasts from the day it's bought. */
export const VOICE_PACK_MONTHS = 12;

export interface VoicePack {
  hours: number;
  characters: number;
  used: number;
  /** When it ends (ms). */
  expiresAt: number;
}

/** "$14.99". */
export const packPrice = (hours: VoicePackHours) => `$${(VOICE_PACKS[hours] / 100).toFixed(2)}`;

/** Packs still running, soonest to end first. */
export const livePacks = (packs: VoicePack[], now = Date.now()) =>
  packs.filter((p) => p.expiresAt > now && p.characters > p.used).sort((a, b) => a.expiresAt - b.expiresAt);

/** Seconds of reading left in the packs still running. */
export function packSecondsLeft(packs: VoicePack[], now = Date.now()): number {
  return Math.floor((livePacks(packs, now).reduce((n, p) => n + p.characters - p.used, 0) / CHARACTERS_PER_HOUR) * 3600);
}

/** Whether a member can buy more hours: a paid-up membership billed through Stripe, outside the free week. */
export function canBuyVoiceHours(account: { complimentary: boolean; pastDue?: boolean; status: string; trialUntil?: string | null } | null, now = Date.now()): boolean {
  if (!account || account.complimentary || account.pastDue || account.status !== "active") return false;
  return !(account.trialUntil && Date.parse(account.trialUntil) > now);
}
