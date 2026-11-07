import type { Profile, ProfileData } from "../types";
import { CHARACTERS_PER_HOUR } from "./naturalVoice";

/**
 * The family listening report (Account → Family): this month's audiobook listening and new
 * natural-voice reading per profile, so the grown-ups see where the plan's hours go. Listening
 * comes from each profile's readingDays (`listened`); natural voices from
 * natural_voice_profile_usage (characters, read as time at CHARACTERS_PER_HOUR).
 */
export interface FamilyUsageRow {
  profileId: string;
  name: string;
  /** Seconds of audiobook listening this month. */
  listened: number;
  /** Seconds of new natural-voice reading voiced this month. */
  natural: number;
}

/** "2026-11": the month a local day ("2026-11-07") falls in. */
export const monthOf = (day: string) => day.slice(0, 7);

/** Each profile's month, most used first (profiles with nothing come last, in their usual order). */
export function familyUsage(profiles: Pick<Profile, "id" | "name">[], data: Record<string, Pick<ProfileData, "readingDays">>, naturalCharacters: Record<string, number>, month: string): FamilyUsageRow[] {
  const rows = profiles.map((p) => {
    const days = data[p.id]?.readingDays ?? {};
    const listened = Object.entries(days).reduce((n, [day, d]) => (monthOf(day) === month ? n + (d.listened ?? 0) : n), 0);
    const natural = ((naturalCharacters[p.id] ?? 0) / CHARACTERS_PER_HOUR) * 3600;
    return { profileId: p.id, name: p.name, listened, natural };
  });
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => b.row.listened + b.row.natural - (a.row.listened + a.row.natural) || a.i - b.i)
    .map(({ row }) => row);
}
