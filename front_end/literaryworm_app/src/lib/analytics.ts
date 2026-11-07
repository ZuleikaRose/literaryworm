/**
 * Ahrefs Web Analytics (the script in index.html, held back by Termly until analytics is
 * allowed). It sets no cookies. The tag has `data-no-pageview-auto`, so it sends nothing on its
 * own: `components/Analytics.tsx` sends each page view with only the page's path (never what's
 * after ? or #), and turns it off while a Kids profile is active and on pages whose addresses
 * carry private codes. The script reads its `data-key` before every event and sends nothing
 * without one, so taking the key off pauses it, clicks included.
 */

export const ANALYTICS_SRC = "https://analytics.ahrefs.com/";

/** Pages whose links can carry codes or tokens, and staff tools: analytics stays off there. */
const PRIVATE_PATHS = [
  /^\/signin\b/,
  /^\/signup\b/,
  /^\/reset-password\b/,
  /^\/unsubscribe\b/,
  /^\/clubs\/join\//,
  /^\/lists\//,
  // Clips from uploads name the upload.
  /^\/clips\/u-/,
  /^\/support\b/,
  /^\/dashboard\b/,
  /^\/maintenance\b/,
  /^\/affiliates\/review\b/,
];

/** Whether analytics may run on this page for this profile: never for Kids, never on private pages. */
export function analyticsAllowed(pathname: string, kidsProfile: boolean): boolean {
  return !kidsProfile && !PRIVATE_PATHS.some((p) => p.test(pathname));
}

/** The address Ahrefs is given: the path only, so search words, filters and codes never go. */
export function pageLocation(pathname: string): string {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

/** The parts of a script element this module touches (a real one in the browser, a fake in tests). */
export interface AnalyticsTag {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

let key: string | null = null;

/** Give every Ahrefs tag the page's path, and its key only while analytics is allowed. */
export function applyAnalytics(tags: AnalyticsTag[], pathname: string, kidsProfile: boolean): boolean {
  const on = analyticsAllowed(pathname, kidsProfile);
  for (const tag of tags) {
    key = tag.getAttribute("data-key") ?? key;
    tag.setAttribute("data-page-location", pageLocation(pathname));
    if (on && key) tag.setAttribute("data-key", key);
    else tag.removeAttribute("data-key");
  }
  return on && key !== null;
}

/** Ahrefs' tags on the page (Termly may swap a blocked one for a new one once allowed). */
export function analyticsTags(): HTMLScriptElement[] {
  return [...document.querySelectorAll<HTMLScriptElement>(`script[src^="${ANALYTICS_SRC}"]`)];
}

type AhrefsWindow = Window & { AhrefsAnalytics?: { sendEvent(name: string): void } };

/** A page view, if the script has loaded (otherwise its ready event sends one). */
export function sendPageView(): void {
  (window as AhrefsWindow).AhrefsAnalytics?.sendEvent("pageview");
}

/** For tests: forget the key seen so far. */
export function resetAnalyticsKey(): void {
  key = null;
}
