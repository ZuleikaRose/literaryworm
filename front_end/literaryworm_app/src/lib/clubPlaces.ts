import type { ClubMember } from "./clubs";

/**
 * Where everyone is in a club's book: members who chose to show their place (club_members.share_place),
 * from club_places() for members, sample places in the demo. A chapter number isn't a spoiler.
 */

export interface ClubPlace {
  userId: string;
  name: string;
  /** 0-based, like reading progress. */
  chapterIndex: number;
  /** 0–1 through the whole book. */
  fraction: number;
  finished: boolean;
  updatedAt: number;
}

/** How often an open club page asks again, besides when the tab comes back. */
export const PLACES_REFRESH_MS = 60_000;

/** "Finished", or "Chapter 8 · 42%". */
export function placeLabel(place: Pick<ClubPlace, "chapterIndex" | "fraction" | "finished">): string {
  if (place.finished) return "Finished";
  return `Chapter ${place.chapterIndex + 1} · ${Math.round(Math.max(0, Math.min(1, place.fraction)) * 100)}%`;
}

/** Furthest first; ties by name. */
export function sortPlaces(places: ClubPlace[]): ClubPlace[] {
  return [...places].sort((a, b) => Number(b.finished) - Number(a.finished) || b.fraction - a.fraction || a.name.localeCompare(b.name));
}

/** The demo's sample places: the other members, part of the way through. */
export function demoPlaces(members: ClubMember[], me: string, now = Date.now()): ClubPlace[] {
  return members
    .filter((m) => m.userId !== me)
    .map((m, i) => ({ userId: m.userId, name: m.name, chapterIndex: 3 + i * 5, fraction: 0.18 + i * 0.27, finished: false, updatedAt: now - (i + 1) * 3_600_000 }));
}
