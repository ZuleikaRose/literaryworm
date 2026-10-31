/**
 * Passkeys (WebAuthn, through Supabase Auth): a way to log in with the phone, computer or security
 * key itself (Face ID, Touch ID, Windows Hello, a phone's screen lock, a password manager or a
 * YubiKey) instead of typing the password. The browser keeps the private key; Supabase keeps only
 * the public key, a name and when it was added and last used. Fingerprints and faces never leave
 * the device.
 *
 * The calls are in accountApi.ts; this file holds the rules and the words.
 */

/** Supabase's limit on a passkey's name. */
export const PASSKEY_NAME_MAX = 120;

/** What the account page shows for one passkey. */
export interface Passkey {
  id: string;
  name: string;
  /** Milliseconds since 1970. */
  createdAt: number;
  lastUsedAt: number | null;
}

/** Supabase's list item, as it arrives. */
export interface PasskeyRow {
  id: string;
  friendly_name?: string | null;
  created_at: string;
  last_used_at?: string | null;
}

const time = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

/** Supabase names a passkey after where it's kept (iCloud Keychain, 1Password); without one, a plain name. */
export function toPasskey(row: PasskeyRow): Passkey {
  return {
    id: row.id,
    name: row.friendly_name?.trim() || "Passkey",
    createdAt: time(row.created_at) ?? 0,
    lastUsedAt: time(row.last_used_at),
  };
}

/** Newest first, so the one just added is at the top. */
export function sortPasskeys(list: Passkey[]): Passkey[] {
  return [...list].sort((a, b) => b.createdAt - a.createdAt);
}

/** Checks a new name the same way Supabase does (1 to 120 characters once trimmed). */
export function passkeyNameError(name: string): string | null {
  const v = name.trim();
  if (!v) return "Enter a name, such as the device it's on.";
  if (v.length > PASSKEY_NAME_MAX) return `Use ${PASSKEY_NAME_MAX} characters or fewer.`;
  return null;
}

/** Whether this browser can make and use passkeys at all (WebAuthn needs a secure page too). */
export function passkeysSupported(win: { PublicKeyCredential?: unknown; isSecureContext?: boolean } | undefined = globalThis as never): boolean {
  return Boolean(win && typeof win.PublicKeyCredential === "function" && win.isSecureContext !== false);
}

/** The bits of an error the messages below look at: Supabase's `code`, a WebAuthnError's `code`, the browser's `name`. */
export interface PasskeyProblem {
  code?: string;
  name?: string;
  status?: number;
  message?: string;
  cause?: { name?: string } | unknown;
}

/** Plain words for what went wrong, for adding a passkey ("add") or logging in with one ("signin"). */
export function passkeyMessage(error: PasskeyProblem, during: "add" | "signin"): string {
  const code = error.code ?? "";
  const causeName = typeof error.cause === "object" && error.cause !== null ? (error.cause as { name?: string }).name : undefined;
  const name = error.name ?? "";
  // The person closed the prompt, or it timed out: not a failure worth alarming anyone about.
  if (code === "ERROR_CEREMONY_ABORTED" || name === "NotAllowedError" || causeName === "NotAllowedError" || name === "AbortError")
    return during === "add" ? "No passkey was added. Try again when you're ready." : "Passkey log-in was cancelled. Try again, or log in with your password.";
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED" || code === "webauthn_credential_exists")
    return "That device or security key already has a passkey for this account.";
  if (code === "too_many_passkeys") return "This account has the most passkeys it can have. Remove one you no longer use, then add the new one.";
  if (code === "passkey_disabled") return "Passkeys aren't available right now. Log in with your password.";
  if (code === "webauthn_credential_not_found")
    return "That passkey isn't linked to a LiteraryWorm account. Log in with your password, then add a passkey in Account → Sign-in.";
  if (code === "webauthn_challenge_expired" || code === "webauthn_challenge_not_found") return "That took too long. Try again.";
  if (code === "webauthn_verification_failed") return "We couldn't check that passkey. Try again, or use another one.";
  if (code === "email_not_confirmed") return "Confirm your email first: open the link we sent you, then log in.";
  if (code === "user_banned") return "This account can't log in. Contact support.";
  if (code === "ERROR_INVALID_DOMAIN" || code === "ERROR_INVALID_RP_ID")
    return "Passkeys only work on literaryworm.com. Open the site there and try again.";
  if (error.status === 429) return "Too many tries in a short time. Wait a few minutes, then try again.";
  if ((error.message ?? "").toLowerCase().includes("fetch")) return "We couldn't reach LiteraryWorm. Check your connection and try again.";
  return during === "add" ? "We couldn't add the passkey. Try again." : "We couldn't log you in with a passkey. Try again, or log in with your password.";
}
