/**
 * Coming back from an email-change confirmation link (`EMAIL_CHANGED_PATH`, /account?email=changed).
 * Supabase Auth puts what happened in the address: after the first of the two links a `message`,
 * after the second the new session's tokens (which supabase-js reads and then clears), after an
 * expired or used link an `error_code`. This module is imported first in main.tsx, so it reads the
 * address before supabase-js clears it.
 */

export type EmailReturn =
  /** One of the two links followed: the other address still has to confirm. */
  | { kind: "partial" }
  /** The link didn't work. */
  | { kind: "error"; expired: boolean }
  /** Back from the second link (or nothing said): the account shows which address is in use. */
  | { kind: "back" };

export function readEmailReturn(search: string, hash: string): EmailReturn | null {
  if (new URLSearchParams(search).get("email") !== "changed") return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  for (const [key, value] of new URLSearchParams(search)) if (!params.has(key)) params.set(key, value);
  if (params.has("error") || params.has("error_code") || params.has("error_description")) {
    const code = params.get("error_code") ?? "";
    const text = (params.get("error_description") ?? "").toLowerCase();
    return { kind: "error", expired: code === "otp_expired" || text.includes("expired") || text.includes("invalid") };
  }
  if ((params.get("message") ?? "").toLowerCase().includes("other email")) return { kind: "partial" };
  return { kind: "back" };
}

let snapshot: EmailReturn | null = typeof window === "undefined" ? null : readEmailReturn(window.location.search, window.location.hash);

/** What the address said when the app loaded, once (Account shows it). */
export function takeEmailReturn(): EmailReturn | null {
  const found = snapshot;
  snapshot = null;
  return found;
}
