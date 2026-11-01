/** Which notification state a device is in, and the key conversion: no browser or Supabase here, so tests can load it. */

export type PushState =
  /** The browser can't (or this copy of the app has no service worker or backend). */
  | "unsupported"
  /** iPhone or iPad in Safari: add LiteraryWorm to the Home Screen first. */
  | "install-first"
  /** The person said no in the browser; only the browser's site settings can undo it. */
  | "blocked"
  | "off"
  | "on";

export interface PushEnvironment {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  permission: NotificationPermission | null;
  /** iOS or iPadOS, where Web Push works only in a Home Screen app. */
  apple: boolean;
  standalone: boolean;
  subscribed: boolean;
  backend: boolean;
  production: boolean;
}

/** What Account → Preferences shows for this device. */
export function pushState(env: PushEnvironment): PushState {
  if (!env.backend || !env.production) return "unsupported";
  if (env.apple && !env.standalone && !(env.hasPushManager && env.hasNotification)) return "install-first";
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return "unsupported";
  if (env.permission === "denied") return "blocked";
  return env.subscribed && env.permission === "granted" ? "on" : "off";
}

/** The key as the browser wants it. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = new Uint8Array(new ArrayBuffer(base64.length * 0.75 - (base64.match(/=+$/)?.[0].length ?? 0)));
  const raw = atob(base64);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** The kinds of notification an account chooses from (account_private.push_kinds, all on to begin with). */
export const PUSH_KINDS = [
  { id: "release", label: "A book I'm waiting for comes out" },
  { id: "meeting", label: "A book club meeting is coming up" },
  { id: "club_posts", label: "New posts in my book clubs (only up to my chapter)" },
  { id: "streak", label: "An evening nudge to keep a reading streak" },
  { id: "request", label: "A grown-up answers a Kids profile's book request" },
] as const;
export type PushKind = (typeof PUSH_KINDS)[number]["id"];

export const isPushKind = (value: string): value is PushKind => PUSH_KINDS.some((k) => k.id === value);

/** Turns one kind on or off, keeping the list's order. */
export function toggleKind(kinds: PushKind[], kind: PushKind, on: boolean): PushKind[] {
  const next = new Set(kinds);
  if (on) next.add(kind);
  else next.delete(kind);
  return PUSH_KINDS.map((k) => k.id).filter((k) => next.has(k));
}
