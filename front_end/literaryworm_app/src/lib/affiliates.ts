// The affiliate program's rules (stories 82–84; migration 6679). An approved affiliate shares a
// sign-up link with their code; when someone who signed up with it makes their first payment, the
// affiliate earns COMMISSION_SHARE of that payment as a credit on their own membership. The same
// checks as the database, so the form can say what's wrong before sending.

import { tk } from "./i18n";

/** Affiliate codes: 10 characters from the same alphabet as invitation codes (which have 8). */
const CODE = /^[A-HJ-NP-Z2-9]{10}$/;

/** The share of a referred member's first payment an affiliate earns, as account credit. */
export const COMMISSION_SHARE = 0.2;

export const CHANNELS_MIN = 10;
export const CHANNELS_MAX = 500;
export const WEBSITE_MAX = 308;

export type AffiliateStatus = "pending" | "approved" | "declined" | "suspended";

export function cleanAffiliateCode(input: string | null | undefined): string | null {
  const code = (input ?? "").trim().toUpperCase();
  return CODE.test(code) ? code : null;
}

/** The link an affiliate shares: the sign-up page with their code. */
export const affiliateLink = (code: string, origin = typeof window === "undefined" ? "https://www.literaryworm.com" : window.location.origin) =>
  `${origin}/signup?aff=${encodeURIComponent(code)}`;

/** What an affiliate earns from a first payment, in cents (rounded down, as the database does). */
export const commissionCents = (firstPaymentCents: number): number => Math.max(0, Math.floor(firstPaymentCents * COMMISSION_SHARE));

export interface Application {
  website: string;
  channels: string;
  disclosesCommission: boolean;
  noMarketingToChildren: boolean;
  acceptsTerms: boolean;
}

/** The form's errors, field by field (English keys, shown with t()); empty when it can be sent. */
export function applicationErrors(a: Application): Partial<Record<keyof Application, string>> {
  const errors: Partial<Record<keyof Application, string>> = {};
  const website = a.website.trim();
  if (!/^https:\/\/\S{4,300}$/.test(website) || website.length > WEBSITE_MAX) {
    errors.website = tk("Enter your site's address, starting https://");
  }
  const channels = a.channels.trim();
  if (channels.length < CHANNELS_MIN || channels.length > CHANNELS_MAX) {
    errors.channels = tk("Say in a sentence or two how you'll share LiteraryWorm (10 to 500 characters).");
  }
  if (!a.acceptsTerms) errors.acceptsTerms = tk("Agree to the program terms to apply.");
  if (!a.disclosesCommission) errors.disclosesCommission = tk("Affiliates must say they earn a commission wherever they share the link.");
  if (!a.noMarketingToChildren) errors.noMarketingToChildren = tk("Affiliates must not market LiteraryWorm to children.");
  return errors;
}

export const statusLabel: Record<AffiliateStatus, string> = {
  pending: tk("Waiting for review"),
  approved: tk("Approved"),
  declined: tk("Not approved"),
  suspended: tk("Suspended"),
};
