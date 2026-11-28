// Calls for connected apps. Everything goes through the `mcp` Edge Function with the member's own
// session: it checks two-step sign-in, and approving also checks the account password. The browser
// never sees an app's tokens, and never reads the connected_apps tables.

import { callFunction } from "./accountApi";
import { type ConnectedApp, parseConnectedApps } from "./connectedApps";

/** The app asking to connect: its own name, and where it sends the member back. */
export interface ConnectionRequest {
  app: string;
  redirectUri: string;
  /** The app also asked to change the library (add books, change a book's status). */
  library: boolean;
}

export async function connectionRequest(request: string): Promise<ConnectionRequest> {
  const answer = await callFunction<Partial<ConnectionRequest>>("mcp/consent", { action: "details", request }, "We couldn't find that request. Go back to the app and connect again.");
  return {
    app: typeof answer.app === "string" ? answer.app : "",
    redirectUri: typeof answer.redirectUri === "string" ? answer.redirectUri : "",
    library: answer.library === true,
  };
}

/**
 * Allows the app (the account password is checked on the server), letting it change the library
 * only when `library` (and the app asked to). Returns where to send the browser.
 */
export async function allowConnection(request: string, password: string, library = false): Promise<string> {
  const answer = await callFunction<{ redirectTo: string }>("mcp/consent", { action: "approve", request, password, library }, "We couldn't connect the app. Try again.");
  return answer.redirectTo;
}

/** Refuses the app. Returns where to send the browser, so the app hears the answer. */
export async function refuseConnection(request: string): Promise<string> {
  const answer = await callFunction<{ redirectTo: string }>("mcp/consent", { action: "deny", request }, "We couldn't answer the app. Close this tab to refuse it.");
  return answer.redirectTo;
}

export async function listConnectedApps(): Promise<ConnectedApp[]> {
  const answer = await callFunction<{ apps: unknown }>("mcp/apps", { action: "list" }, "We couldn't load your connected apps. Try again.");
  return parseConnectedApps(answer.apps);
}

export async function removeConnectedApp(id: string): Promise<void> {
  await callFunction<{ removed: boolean }>("mcp/apps", { action: "remove", id }, "We couldn't remove that app. Try again.");
}
