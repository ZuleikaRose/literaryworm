import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHARACTERS_PER_HOUR } from "./naturalVoice";
import { canBuyVoiceHours, livePacks, packPrice, packSecondsLeft, VOICE_PACKS } from "./voicePacks";

describe("more natural-voice hours", () => {
  it("has the same prices as checkout", () => {
    const stripe = readFileSync(join(__dirname, "../../../../supabase/functions/_shared/stripe.ts"), "utf8");
    expect(stripe).toContain(`export const VOICE_PACKS = { 5: ${VOICE_PACKS[5]}, 10: ${VOICE_PACKS[10]} } as const;`);
    expect(packPrice(5)).toBe("$14.99");
    expect(packPrice(10)).toBe("$24.99");
  });

  it("counts what's left in packs still running, ending soonest first", () => {
    const now = Date.parse("2026-11-07T00:00:00Z");
    const packs = [
      { hours: 10, characters: 10 * CHARACTERS_PER_HOUR, used: 0, expiresAt: now + 2e10 },
      { hours: 5, characters: 5 * CHARACTERS_PER_HOUR, used: 2 * CHARACTERS_PER_HOUR, expiresAt: now + 1e9 },
      { hours: 5, characters: 5 * CHARACTERS_PER_HOUR, used: 0, expiresAt: now - 1 },
      { hours: 5, characters: 5 * CHARACTERS_PER_HOUR, used: 5 * CHARACTERS_PER_HOUR, expiresAt: now + 1e9 },
    ];
    expect(livePacks(packs, now).map((p) => p.hours)).toEqual([5, 10]);
    expect(packSecondsLeft(packs, now)).toBe(13 * 3600);
    expect(packSecondsLeft([], now)).toBe(0);
  });

  it("is for paid-up memberships only: not staff, a failed payment, a pause or the free week", () => {
    const now = Date.parse("2026-11-07T00:00:00Z");
    const member = { complimentary: false, pastDue: false, status: "active", trialUntil: null };
    expect(canBuyVoiceHours(member, now)).toBe(true);
    expect(canBuyVoiceHours({ ...member, complimentary: true }, now)).toBe(false);
    expect(canBuyVoiceHours({ ...member, pastDue: true }, now)).toBe(false);
    expect(canBuyVoiceHours({ ...member, status: "paused" }, now)).toBe(false);
    expect(canBuyVoiceHours({ ...member, trialUntil: "2026-11-10T00:00:00Z" }, now)).toBe(false);
    expect(canBuyVoiceHours({ ...member, trialUntil: "2026-11-01T00:00:00Z" }, now)).toBe(true);
    expect(canBuyVoiceHours(null, now)).toBe(false);
  });
});
