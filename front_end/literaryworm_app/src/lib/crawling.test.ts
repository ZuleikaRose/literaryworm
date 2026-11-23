import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { headerValues, rewriteFor, type VercelConfig } from "./vercelRoutes";

/**
 * What search engines may fetch and index must agree across robots.txt, the sitemap and vercel.json:
 * every sitemap page can be fetched and indexed; pages kept out of search results say "noindex" and
 * are fetchable (a page robots.txt blocks never shows its noindex); every route the app has is served
 * the app, and any other address is a real 404 rather than a copy of Home.
 */
const read = (path: string) => readFileSync(join(__dirname, "../..", path), "utf8");
const vercel = JSON.parse(read("vercel.json")) as VercelConfig;
const robots = read("public/robots.txt");
const sitemapUrls = [...read("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const sitemapPaths = new Set(sitemapUrls.map((url) => new URL(url).pathname));
// shell.html, by its clean address (cleanUrls: a rewrite to "/shell.html" finds nothing).
const SHELL = "/shell";

/** The Disallow rules robots.txt gives every crawler (User-agent: *), as patterns. */
function disallowedForAll(): RegExp[] {
  const groups = robots.split(/\n(?=User-agent:)/);
  const all = groups.find((g) => /^User-agent:\s*\*\s*$/m.test(g)) ?? "";
  return [...all.matchAll(/^Disallow:\s*(\S+)\s*$/gm)].map(
    (m) => new RegExp(`^${m[1].replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`),
  );
}
const blocked = (address: string) => disallowedForAll().some((rule) => rule.test(address));
const noindexed = (address: string) => headerValues(vercel, address, "X-Robots-Tag").includes("noindex");

/** Addresses that must stay out of search results: members' pages, logging in, one-off links, searches. */
const KEPT_OUT = [
  "/account",
  "/library",
  "/profiles",
  "/browse",
  "/gifts",
  "/dashboard",
  "/support",
  "/maintenance",
  "/signin",
  "/reset-password",
  "/unsubscribe",
  "/affiliates/review",
  "/oauth/consent",
  "/read/dune",
  "/listen/dune",
  "/clubs/abc",
  "/clubs/join/CODE",
  "/lists/my-list",
  "/clips/dune",
  "/search?q=dune",
  "/search?genre=fantasy",
  "/search?by=author&q=austen",
];

describe("robots.txt and the sitemap", () => {
  it("point to each other", () => {
    expect(robots).toMatch(/^Sitemap: https:\/\/www\.literaryworm\.com\/sitemap\.xml$/m);
    expect(sitemapUrls.length).toBeGreaterThan(0);
  });

  it("let crawlers fetch every page in the sitemap, and none of them says noindex", () => {
    expect(sitemapUrls.filter((url) => blocked(new URL(url).pathname))).toEqual([]);
    expect(sitemapUrls.filter((url) => noindexed(new URL(url).pathname))).toEqual([]);
  });

  it("keep members' pages, logging in and searches out of search results with noindex, fetchable so it's seen", () => {
    expect(KEPT_OUT.filter((address) => !noindexed(address))).toEqual([]);
    expect(KEPT_OUT.filter((address) => blocked(address))).toEqual([]);
    expect(KEPT_OUT.filter((address) => !address.includes("?") && sitemapPaths.has(address))).toEqual([]);
  });

  it("leave the search page itself, and other pages with a query, indexable under their canonical", () => {
    expect(noindexed("/search")).toBe(false);
    expect(noindexed("/pricing?plan=premium")).toBe(false);
    expect(noindexed("/?ref=ABC")).toBe(false);
  });

  it("still keep the spam bot out entirely", () => {
    expect(robots).toMatch(/User-agent: MJ12bot\nDisallow: \/\n/);
  });
});

describe("vercel.json routing", () => {
  it("serves each page at one address: no .html and no trailing slash", () => {
    expect(vercel.cleanUrls).toBe(true);
    expect(vercel.trailingSlash).toBe(false);
  });

  it("serves the app at every route App.tsx has", () => {
    const app = read("src/App.tsx");
    const routes = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== "*");
    // /plans and /book/:id are redirected before any rewrite (canonicalHeaders.test.ts).
    const redirected = new Set(["plans", "book/:id"]);
    const paths = routes.filter((r) => !redirected.has(r)).map((r) => `/${r.replace(/:\w+/g, "sample-id")}`);
    expect(paths.length).toBeGreaterThan(20);
    expect(paths.filter((path) => rewriteFor(vercel, path) !== SHELL)).toEqual([]);
  });

  it("answers 404 for addresses the app doesn't have, instead of a copy of Home", () => {
    for (const path of ["/nope", "/books/dune/extra", "/wp-login.php", "/index.php", "/legal"]) {
      expect(rewriteFor(vercel, path)).toBeNull();
    }
  });

  it("still sends the book texts, connected apps and their OAuth addresses to Supabase", () => {
    expect(rewriteFor(vercel, "/texts/dune.json")).toMatch(/\/storage\/v1\/object\/public\/book-texts\/:file$/);
    expect(rewriteFor(vercel, "/mcp")).toMatch(/\/functions\/v1\/mcp$/);
    expect(rewriteFor(vercel, "/.well-known/oauth-authorization-server")).toMatch(/\/functions\/v1\/mcp\/\.well-known\//);
  });
});
