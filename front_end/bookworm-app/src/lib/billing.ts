/** Billing dates, shown on Plans and Account. */

/** 1 → "1st", 22 → "22nd". */
export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** The next time a plan billed on `day` (1–28) renews, after `from`. */
export function nextBillingDate(day: number, from = new Date()): Date {
  const next = new Date(from.getFullYear(), from.getMonth(), day);
  if (next <= from) next.setMonth(next.getMonth() + 1);
  return next;
}

export const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** A plan's end date. The server stores it as midnight UTC on the billing day, so read the day in UTC. */
export const endDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
