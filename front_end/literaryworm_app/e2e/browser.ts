import { type Browser, chromium, type Page } from "playwright-core";
import { BASE_URL } from "./config";

/**
 * A page on the e2e server that keeps the run self-contained: requests to other sites (Termly's
 * consent banner, Google Books covers, fonts, LibriVox audio) are refused, so the tests never
 * depend on the network, and every console error and uncaught exception is collected.
 */
export interface TestPage {
  page: Page;
  /** Console errors and page errors so far, minus the refused third-party requests. */
  errors: () => string[];
}

let browser: Browser | null = null;

export async function openBrowser(): Promise<Browser> {
  browser ??= await chromium.launch();
  return browser;
}

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = null;
}

export async function newPage(width = 1440, height = 900): Promise<TestPage> {
  const context = await (await openBrowser()).newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/*", (route) => (route.request().url().startsWith(BASE_URL) ? route.continue() : route.abort()));
  return {
    page,
    // A refused request is logged by the browser as a failed load; those are the test's own doing.
    errors: () => errors.filter((e) => !/Failed to load resource|ERR_FAILED|net::ERR_/.test(e)),
  };
}

/** Opens the demo household from the log-in page and lands on Discover as its first profile. */
export async function signInDemo(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/signin`);
  await page.getByRole("button", { name: "Try the demo" }).click();
  await page.waitForURL(/\/(profiles|browse)/);
  if (page.url().includes("/profiles")) await page.locator("main button").first().click();
  await page.waitForURL(/\/browse/);
}

/**
 * Moves within the app without reloading it: the demo lives in memory, so a full page load
 * would sign it out. Uses the router's own history handling.
 */
export async function goInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((to) => {
    history.pushState({}, "", to);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/** True when the page is wider than the window (sideways scrolling on a phone). */
export const scrollsSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
