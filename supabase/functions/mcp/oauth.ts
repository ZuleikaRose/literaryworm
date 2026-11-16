// The pure parts of the mcp function's small OAuth 2.1 server: tokens and their hashes, PKCE
// (S256 only), and the rules for where an app may send a member back. No I/O here.

const encoder = new TextEncoder();

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** A new secret: a prefix that says what it is, then 256 random bits in hex. */
export function randomToken(prefix: "lw_ac_" | "lw_at_" | "lw_rt_"): string {
  return prefix + hex(crypto.getRandomValues(new Uint8Array(32)));
}

/** What's stored instead of a code or token. */
export async function sha256Hex(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

/** RFC 7636's S256: base64url(SHA-256(verifier)), no padding. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier)));
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export const CODE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
export const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
export const TOKEN = /^lw_(ac|at|rt)_[0-9a-f]{64}$/;

export const CLIENT_NAME_MAX = 80;
export const REDIRECT_URI_MAX = 300;
export const REDIRECT_URIS_MAX = 5;
export const STATE_MAX = 512;

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
// Schemes a browser would run or open itself: never somewhere to send a code.
const REFUSED_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:", "about:", "ftp:", "ws:", "wss:", "mailto:", "tel:", "sms:"]);

function parsed(uri: string): URL | null {
  try {
    return new URL(uri);
  } catch {
    return null;
  }
}

export const isLoopback = (url: URL): boolean => url.protocol === "http:" && LOOPBACK.has(url.hostname);

/**
 * Why an app can't register this redirect address, or null when it can: https anywhere, http only
 * on this computer (a command-line tool's own listener), or an installed app's own scheme.
 */
export function redirectUriProblem(uri: unknown): string | null {
  if (typeof uri !== "string" || uri.length === 0 || uri.length > REDIRECT_URI_MAX) {
    return `Each redirect URI must be 1 to ${REDIRECT_URI_MAX} characters.`;
  }
  const url = parsed(uri);
  if (!url) return "Each redirect URI must be a full address.";
  if (url.hash) return "A redirect URI can't have a fragment.";
  if (url.username || url.password) return "A redirect URI can't carry a user name or password.";
  if (url.protocol === "https:") return null;
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname) ? null : "A redirect URI must use https, unless it's on this computer (localhost).";
  return REFUSED_SCHEMES.has(url.protocol) ? "That kind of redirect URI isn't allowed." : null;
}

/**
 * True when the address an app asks to be sent back to is one it registered: the same text, or,
 * on this computer, the same host and path on any port (RFC 8252: such apps listen where they can).
 */
export function redirectAllowed(registered: readonly string[], asked: string): boolean {
  if (registered.includes(asked)) return true;
  const want = parsed(asked);
  if (!want || !isLoopback(want) || want.hash || want.search) return false;
  return registered.some((r) => {
    const have = parsed(r);
    return !!have && isLoopback(have) && have.hostname === want.hostname && have.pathname === want.pathname;
  });
}

/** Where the member's browser goes after deciding: the app's address with the code, or the refusal. */
export function decisionRedirect(redirectUri: string, issuer: string, state: string | null, outcome: { code: string } | { error: string }): string {
  const url = new URL(redirectUri);
  if ("code" in outcome) url.searchParams.set("code", outcome.code);
  else url.searchParams.set("error", outcome.error);
  if (state !== null) url.searchParams.set("state", state);
  // RFC 9207: says which server answered, so an app talking to several can't be mixed up.
  url.searchParams.set("iss", issuer);
  return url.toString();
}

/** A registered name with control characters dropped and spaces tidied, or null when nothing's left or it's too long. */
export function cleanClientName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // deno-lint-ignore no-control-regex
  const name = raw.normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= CLIENT_NAME_MAX ? name : null;
}
