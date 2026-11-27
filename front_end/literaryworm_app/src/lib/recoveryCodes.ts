// Recovery codes for two-step sign-in (migration 6866, the recovery-code function): the rules the
// log-in page and Account share. The database makes, keeps (as hashes) and checks the codes; this
// only reads what a member types and lays the codes out to save.

/** How many codes are made at a time (create_recovery_codes()). */
export const RECOVERY_CODE_COUNT = 10;

/** Crockford base32, as the database makes them: no i, l, o or u. */
const SHAPE = /^[0-9a-hjkmnp-tv-z]{10}$/;

/**
 * A code as the database reads it (private.recovery_code_text()): case, spaces and dashes don't
 * matter, and o, i and l are read as the digits they look like.
 */
export function cleanRecoveryCode(input: string): string {
  return input
    .replace(/[\s-]/g, "")
    .toLowerCase()
    .replace(/o/g, "0")
    .replace(/[il]/g, "1");
}

/** True when what was typed could be a recovery code (10 characters once cleaned). */
export function looksLikeRecoveryCode(input: string): boolean {
  return SHAPE.test(cleanRecoveryCode(input));
}

/** The codes as a plain-text page to keep (copied or downloaded; made in the browser, never sent). */
export function recoveryCodesText(codes: string[], madeOn: Date, email: string): string {
  return [
    "LiteraryWorm recovery codes",
    `For ${email}, made ${madeOn.toISOString().slice(0, 10)}.`,
    "",
    "Each code logs you in once if you can't use your authenticator app.",
    "Using one turns two-step sign-in off: set it up again, and make new codes, in Account → Sign-in.",
    "Making new codes stops these from working.",
    "",
    ...codes,
    "",
  ].join("\n");
}

export function recoveryCodesFileName(madeOn: Date): string {
  return `literaryworm-recovery-codes-${madeOn.toISOString().slice(0, 10)}.txt`;
}
