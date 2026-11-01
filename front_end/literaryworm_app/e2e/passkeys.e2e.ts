import { type ChildProcess, spawn } from "node:child_process";
import { generateKeyPairSync, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import type { Page, Route } from "playwright-core";
import { closeBrowser, openBrowser } from "./browser";

/**
 * A passkey log-in counts as both steps of two-step sign-in (migration 6530): after one, the app
 * goes straight in instead of asking for the authenticator code, on every screen size.
 *
 * The rest of the e2e run has no backend, so this file starts its own copy of the app with
 * Supabase settings pointing at a stand-in that the test answers itself: Auth hands out a passkey
 * session (aal1, "passkey" in amr) for an account with a verified authenticator app, and
 * second_step_done() says whether the database accepts the passkey (it does when every passkey on
 * the account was added after the code). Chrome's virtual authenticator is the passkey, so the
 * browser's real WebAuthn ceremony runs. The database rule itself is covered on a Supabase branch.
 */

const PORT = Number(process.env.E2E_PASSKEY_PORT ?? 5198);
const APP = `http://localhost:${PORT}`;
const SUPABASE = "https://passkey-test.supabase.co";
const USER_ID = "00000000-0000-4000-8000-000000000001";
/** What loadAccount() and loadLibrary() read first: the member's own data. */
const MEMBER_TABLES = ["profiles", "account_private", "subscriptions", "library_items"];

let server: ChildProcess | null = null;

beforeAll(async () => {
  server = spawn("npx", ["vite", "--mode", "e2e", "--port", String(PORT), "--strictPort"], {
    cwd: `${__dirname}/..`,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, VITE_SUPABASE_URL: SUPABASE, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_passkey_test" },
  });
  let output = "";
  server.stdout?.on("data", (d: Buffer) => (output += d.toString()));
  server.stderr?.on("data", (d: Buffer) => (output += d.toString()));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite stopped before it was ready:\n${output}`);
    try {
      if ((await fetch(APP)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite wasn't ready on ${APP} after 30 seconds:\n${output}`);
}, 40_000);

afterAll(async () => {
  await closeBrowser();
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
  }
});

const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

/** An unsigned JWT: the browser only reads the claims (Auth would have signed a real one). */
function token(claims: Record<string, unknown>): string {
  return `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}.sig`;
}

interface Stand {
  /** Two-step sign-in is on (a verified authenticator app). */
  twoStep: boolean;
  /** What second_step_done() answers for the passkey session. */
  passkeyCounts: boolean;
}

/** Answers the app's Supabase calls; returns what it saw. */
async function standIn(page: Page, stand: Stand) {
  const seen = { stepChecks: 0, accountLoads: 0, codeChecks: 0 };
  const now = Math.floor(Date.now() / 1000);
  const factors = stand.twoStep
    ? [{ id: "f1", factor_type: "totp", status: "verified", friendly_name: "Authenticator app", created_at: "", updated_at: "" }]
    : [];
  const user = {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "reader@example.com",
    email_confirmed_at: "2026-10-01T00:00:00Z",
    app_metadata: { provider: "email" },
    user_metadata: { display_name: "Reader" },
    factors,
    created_at: "2026-10-01T00:00:00Z",
  };
  const session = {
    access_token: token({
      sub: USER_ID,
      role: "authenticated",
      aud: "authenticated",
      email: user.email,
      aal: "aal1",
      amr: [{ method: "passkey", timestamp: now }],
      exp: now + 3600,
      iat: now,
    }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "refresh",
    user,
  };
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === APP) return route.continue();
    if (url.origin !== SUPABASE) return route.abort();
    const { pathname } = url;
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (pathname === "/auth/v1/passkeys/authentication/options")
      return json(route, { challenge_id: "challenge-1", options: { challenge: b64url(randomBytes(32)), rpId: "localhost", userVerification: "preferred", timeout: 60_000 } });
    if (pathname === "/auth/v1/passkeys/authentication/verify") return json(route, session);
    if (pathname === "/auth/v1/user") return json(route, user);
    if (pathname.startsWith("/auth/v1/factors")) {
      seen.codeChecks++;
      return json(route, { code: "mfa_verification_failed", message: "Invalid code" }, 422);
    }
    if (pathname === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (pathname === "/rest/v1/rpc/second_step_done") {
      seen.stepChecks++;
      return json(route, stand.passkeyCounts);
    }
    // Past the second step the app loads the account (public pages like the maintenance banner
    // read their own tables either way); empty answers are enough to see it start.
    if (pathname.startsWith("/rest/v1/")) {
      if (MEMBER_TABLES.some((t) => pathname === `/rest/v1/${t}`)) seen.accountLoads++;
      return json(route, route.request().headers().accept?.includes("vnd.pgrst.object") ? null : []);
    }
    return json(route, {});
  });
  return seen;
}

/** Chrome's virtual authenticator with one passkey for localhost, unlocked by "Face ID". */
async function addPasskey(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: {
      credentialId: randomBytes(16).toString("base64"),
      isResidentCredential: true,
      rpId: "localhost",
      privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
      userHandle: Buffer.from(USER_ID).toString("base64"),
      signCount: 0,
    },
  });
}

async function passkeyLogIn(size: { width: number; height: number; isMobile?: boolean; hasTouch?: boolean }, stand: Stand) {
  const context = await (await openBrowser()).newContext({ viewport: { width: size.width, height: size.height }, isMobile: size.isMobile, hasTouch: size.hasTouch });
  const page = await context.newPage();
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(String(e)));
  const seen = await standIn(page, stand);
  await addPasskey(page);
  await page.goto(`${APP}/signin`);
  await page.getByRole("button", { name: /Log in with a passkey/ }).click();
  // Either the code screen shows, or the app moves on to load the account.
  const codeField = page.getByLabel("6-digit code");
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && seen.accountLoads === 0 && !(await codeField.isVisible())) await page.waitForTimeout(100);
  // A moment more, so a code screen that follows the account load would show too.
  await page.waitForTimeout(500);
  const askedForCode = await codeField.isVisible();
  await context.close();
  return { askedForCode, crashes, ...seen };
}

const SIZES = [
  ["a computer", { width: 1440, height: 900 }],
  ["a tablet", { width: 834, height: 1194, isMobile: true, hasTouch: true }],
  ["a phone", { width: 390, height: 844, isMobile: true, hasTouch: true }],
] as const;

describe("logging in with a passkey when two-step sign-in is on", () => {
  for (const [name, size] of SIZES) {
    it(`goes straight in on ${name}, without asking for the code`, async () => {
      const result = await passkeyLogIn(size, { twoStep: true, passkeyCounts: true });
      expect(result.stepChecks).toBeGreaterThan(0); // the database was asked
      expect(result.askedForCode).toBe(false);
      expect(result.codeChecks).toBe(0);
      expect(result.accountLoads).toBeGreaterThan(0); // the account started loading
      expect(result.crashes).toEqual([]);
    });
  }

  it("asks for the code when the database doesn't accept the passkey (one added without the code)", async () => {
    const result = await passkeyLogIn(SIZES[2][1], { twoStep: true, passkeyCounts: false });
    expect(result.askedForCode).toBe(true);
    expect(result.accountLoads).toBe(0); // nothing of theirs loads before the code
  });
});

it("logging in with a passkey without two-step sign-in goes straight in", async () => {
  const result = await passkeyLogIn(SIZES[0][1], { twoStep: false, passkeyCounts: false });
  expect(result.askedForCode).toBe(false);
  expect(result.stepChecks).toBe(0); // nothing to check
  expect(result.accountLoads).toBeGreaterThan(0);
});
