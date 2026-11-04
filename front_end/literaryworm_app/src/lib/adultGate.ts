// The age gate for books marked mature (Google's MATURE rating, or an Open Library work filed as
// erotica). Kids and Teen profiles never open them (BookDetail shows Not on this shelf). An adult
// profile confirms once that it's 18 or older (ProfileData.matureOkAt; members keep it in
// reader_profiles.mature_ok_at, migration 6684); a visitor without a profile confirms once a visit.

/** A visitor's answer, for this visit only (never stored). */
let visitorConfirmed = false;

export const visitorIsAdult = (): boolean => visitorConfirmed;
export function confirmVisitorAdult(): void {
  visitorConfirmed = true;
}
/** For tests. */
export function resetVisitorAdult(): void {
  visitorConfirmed = false;
}

export type GateCheck = {
  mature: boolean;
  /** The active profile's rating; null for a visitor with no profile. */
  ageRating: "all" | "teen" | "kids" | null;
  /** When the active adult profile confirmed it's 18 or older; null if it hasn't. */
  profileConfirmedAt: number | null;
  visitorConfirmed: boolean;
};

/** What the book page shows: the book, the age gate, or Not on this shelf (Kids and Teen). */
export function adultGate(c: GateCheck): "show" | "gate" | "blocked" {
  if (!c.mature) return "show";
  if (c.ageRating === "teen" || c.ageRating === "kids") return "blocked";
  if (c.ageRating === "all") return c.profileConfirmedAt ? "show" : "gate";
  return c.visitorConfirmed ? "show" : "gate";
}
