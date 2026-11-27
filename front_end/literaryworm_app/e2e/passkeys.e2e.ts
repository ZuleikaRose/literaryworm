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
    // Cloudflare's always-passing Turnstile test key: the widget runs for real and hands over a dummy token.
    env: { ...process.env, VITE_SUPABASE_URL: SUPABASE, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_passkey_test", VITE_TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
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
  /** The recovery code the recovery-code function accepts (it then turns two-step sign-in off). */
  recoveryCode?: string;
}

/** Answers the app's Supabase calls; returns what it saw. */
async function standIn(page: Page, stand: Stand) {
  const seen = { stepChecks: 0, accountLoads: 0, codeChecks: 0, recoveryTries: 0, refreshes: 0, missingCaptcha: 0 };
  const now = Math.floor(Date.now() / 1000);
  const factors = stand.twoStep
    ? [{ id: "f1", factor_type: "totp", status: "verified", friendly_name: "Authenticator app", created_at: "", updated_at: "" }]
    : [];
  const user: { factors: typeof factors } & Record<string, unknown> = {
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
    // Turnstile's widget, which the log-in page shows before a passkey log-in.
    if (url.origin === "https://challenges.cloudflare.com") return route.continue();
    if (url.origin !== SUPABASE) return route.abort();
    const { pathname } = url;
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (pathname === "/auth/v1/passkeys/authentication/options") {
      // Supabase Auth's CAPTCHA protection checks the Turnstile token here.
      const body = JSON.parse(route.request().postData() ?? "{}") as { gotrue_meta_security?: { captcha_token?: string } };
      if (!body.gotrue_meta_security?.captcha_token) {
        seen.missingCaptcha++;
        return json(route, { code: "captcha_failed", message: "captcha protection: request disallowed (no captcha_token found)" }, 400);
      }
      return json(route, { challenge_id: "challenge-1", options: { challenge: b64url(randomBytes(32)), rpId: "localhost", userVerification: "preferred", timeout: 60_000 } });
    }
    if (pathname === "/auth/v1/passkeys/authentication/verify") return json(route, session);
    if (pathname === "/functions/v1/recovery-code") {
      seen.recoveryTries++;
      const { code } = JSON.parse(route.request().postData() ?? "{}") as { code?: string };
      if (!stand.recoveryCode || code !== stand.recoveryCode)
        return json(route, { error: { code: "bad_request", message: "That recovery code isn't right, or it has been used." } }, 400);
      // Two-step sign-in is off now: the account has no verified factor.
      user.factors = [];
      return json(route, { ok: true, twoStep: false });
    }
    if (pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      seen.refreshes++;
      return json(route, { ...session, user });
    }
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

/** Waits for Turnstile's test key to pass (its widget says so), as a person would before logging in. */
async function passTurnstile(page: Page) {
  await page.getByRole("group", { name: "Security check" }).waitFor();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const done = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLIFrameElement>(".turnstile-widget iframe")).length > 0 &&
      // The widget keeps its token in a hidden input only when asked; ask the API instead.
      typeof (window as unknown as { turnstile?: { getResponse?: () => string | undefined } }).turnstile?.getResponse === "function" &&
      Boolean((window as unknown as { turnstile: { getResponse: () => string | undefined } }).turnstile.getResponse()),
    );
    if (done) return;
    await page.waitForTimeout(200);
  }
  throw new Error("Turnstile's test key didn't pass within 20 seconds");
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
  await passTurnstile(page);
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
      expect(result.missingCaptcha).toBe(0); // the Turnstile token went with the passkey challenge
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

it("a recovery code turns two-step sign-in off and logs in, after refusing a wrong one", async () => {
  const context = await (await openBrowser()).newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const crashes: string[] = [];
  page.on("pageerror", (e) => crashes.push(String(e)));
  // A passkey added without the code: the code screen shows, as it would after a password.
  const seen = await standIn(page, { twoStep: true, passkeyCounts: false, recoveryCode: "7k2mp-q9xzt" });
  await addPasskey(page);
  await page.goto(`${APP}/signin`);
  await passTurnstile(page);
  await page.getByRole("button", { name: /Log in with a passkey/ }).click();
  await page.getByRole("button", { name: "Lost your phone? Use a recovery code" }).click();
  const field = page.getByLabel("Recovery code", { exact: true });
  await expect(field.isVisible()).resolves.toBe(true);

  await field.fill("123456");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByText(/10 letters and numbers/).waitFor();
  expect(seen.recoveryTries).toBe(0); // not a code's shape: nothing sent

  await field.fill("aaaaa-bbbbb");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByText(/isn't right, or it has been used/).waitFor();
  expect(seen.accountLoads).toBe(0);

  await field.fill("7k2mp-q9xzt");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.getByRole("heading", { name: "Two-step sign-in is off" }).waitFor();
  await page.getByRole("button", { name: "Continue" }).click();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && seen.accountLoads === 0) await page.waitForTimeout(100);
  expect(seen.refreshes).toBeGreaterThan(0);
  expect(seen.accountLoads).toBeGreaterThan(0); // the account started loading
  expect(crashes).toEqual([]);
  await context.close();
});
