/** Gift memberships: what can be bought, and how codes are typed and shown. */

/** How many months a gift can be bought for (the same as the checkout function's). */
export const GIFT_MONTHS = [1, 3, 6, 12] as const;

export const monthsLabel = (n: number) => `${n} ${n === 1 ? "month" : "months"}`;

/** A code as stored: 16 letters and digits, no 0/O or 1/I. */
const CODE = /^[A-HJ-NP-Z2-9]{16}$/;

/** What the member typed, as the code: dashes, spaces and case don't matter. */
export const normalizeGiftCode = (raw: string) => raw.replace(/[\s-]/g, "").toUpperCase();

/** The same check as the manage-account function. */
export function giftCodeError(raw: string): string | null {
  const code = normalizeGiftCode(raw);
  if (!code) return "Enter the gift code.";
  return CODE.test(code) ? null : "Enter the 16 letters and numbers of the gift code, like ABCD-EFGH-JKLM-NPQR.";
}

/** ABCD-EFGH-JKLM-NPQR: easier to read out and copy by hand. */
export const formatGiftCode = (code: string) => code.match(/.{1,4}/g)?.join("-") ?? code;
