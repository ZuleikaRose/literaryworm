// Connected apps: an AI assistant (over MCP) or the LiteraryWorm command line that a member
// allowed to read their account. The rules here are pure; the calls are in connectedAppsApi.ts and
// the server side is the `mcp` Edge Function, which is the only thing that knows the tokens.

/** What a member adds to an assistant that supports MCP (vercel.json sends it to the function). */
export const MCP_URL = "https://www.literaryworm.com/mcp";
/** The same without logging in: the catalog, pricing and What's new only. */
export const MCP_PUBLIC_URL = "https://www.literaryworm.com/mcp/public";
/** Logs the command line in (cli/ in the repository, published to npm as `literaryworm`). */
export const CLI_LOGIN = "npx literaryworm login";

export interface ConnectedApp {
  id: string;
  /** What the app calls itself. */
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  /** It may add books to the library and change a book's status (the "library" scope). */
  canChangeLibrary: boolean;
}

const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for the `request` the consent page is opened with. */
export const isRequestId = (value: string | null): value is string => value !== null && REQUEST_ID.test(value);

/** Where an app sends the member back after they answer, in words the consent page can show. */
export type ReturnPlace =
  /** A website: its host is shown, so a look-alike name stands out. */
  | { kind: "web"; host: string }
  /** A program on this computer listening for the answer (the command line, a desktop app). */
  | { kind: "device" }
  /** An installed app opened by its own kind of link. */
  | { kind: "app"; scheme: string };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Reads the address the server says the app registered. Null when it isn't an address at all. */
export function returnPlace(redirectUri: string): ReturnPlace | null {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return null;
  }
  if (url.protocol === "https:") return { kind: "web", host: url.host };
  if (url.protocol === "http:") return LOOPBACK.has(url.hostname) ? { kind: "device" } : null;
  return { kind: "app", scheme: url.protocol.replace(/:$/, "") };
}

/** Checks the list the server sent, newest first. */
export function parseConnectedApps(raw: unknown): ConnectedApp[] {
  if (!Array.isArray(raw)) return [];
  const apps: ConnectedApp[] = [];
  for (const item of raw as Partial<ConnectedApp>[]) {
    if (!item || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.createdAt !== "string") continue;
    const scope = (item as { scope?: unknown }).scope;
    apps.push({
      id: item.id,
      name: item.name,
      createdAt: item.createdAt,
      lastUsedAt: typeof item.lastUsedAt === "string" ? item.lastUsedAt : null,
      canChangeLibrary: scope === "read library",
    });
  }
  return apps.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The demo household's sample: one assistant connected three days before the demo started, used yesterday. */
export function demoConnectedApps(now: Date = new Date()): ConnectedApp[] {
  const day = 86_400_000;
  return [{ id: "demo-assistant", name: "Claude", createdAt: new Date(now.getTime() - 3 * day).toISOString(), lastUsedAt: new Date(now.getTime() - day).toISOString(), canChangeLibrary: false }];
}
