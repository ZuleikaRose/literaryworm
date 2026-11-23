import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalUrl } from "./seo";
import { headerValues, type VercelConfig } from "./vercelRoutes";

/**
 * Pages in the sitemap are built with their own canonical link (publicPages.test.ts). vercel.json
 * also sends a canonical as an HTTP `Link` header for public pages that can't all be built ahead
 * (Google Books titles, authors, narrators, readers), which Google reads before rendering. These
 * checks keep those headers in step with canonicalUrl() (what components/Canonical.tsx sets), so a
 * page never gets two different canonicals.
 */
const vercel = JSON.parse(readFileSync(join(__dirname, "../../vercel.json"), "utf8")) as VercelConfig;
const sitemap = readFileSync(join(__dirname, "../../public/sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const MIN_SITEMAP_URLS = 100;

const canonicalHeaders = (path: string) => headerValues(vercel, path, "Link");
const linkFor = (path: string) => `<${canonicalUrl(path)}>; rel="canonical"`;

describe("canonical Link headers (vercel.json)", () => {
  it("never give a page in the sitemap a canonical other than its own address, nor more than one", () => {
    expect(sitemapUrls.length).toBeGreaterThan(MIN_SITEMAP_URLS);
    const wrong = sitemapUrls.filter((url) => {
      const headers = canonicalHeaders(new URL(url).pathname);
      return headers.length > 1 || headers.some((h) => h !== `<${url}>; rel="canonical"`);
    });
    expect(wrong).toEqual([]);
  });

  it("give public pages that aren't built ahead their own address", () => {
    for (const path of ["/books/zyTCAlFPjgYC", "/authors/Jane%20Austen", "/narrators/Karen%20Savage", "/readers/abc123"]) {
      expect(canonicalHeaders(path)).toEqual([linkFor(path)]);
    }
  });

  it("give the top pages theirs, Home included", () => {
    for (const path of ["/", "/pricing", "/whats-new", "/search", "/signup", "/affiliates"]) {
      expect(canonicalHeaders(path)).toEqual([linkFor(path)]);
    }
  });

  it("leave members-only routes, logging in and files alone", () => {
    for (const path of ["/library", "/account", "/signin", "/read/dune", "/listen/dune", "/clubs/abc", "/sitemap.xml", "/assets/index.js"]) {
      expect(canonicalHeaders(path)).toEqual([]);
    }
  });

  it("send the old /book/:id addresses to /books/:id for good", () => {
    expect(vercel.redirects).toContainEqual({ source: "/book/:id", destination: "/books/:id", permanent: true });
  });

  it("send the old /plans address to /pricing for good, and give /plans no canonical of its own", () => {
    expect(vercel.redirects).toContainEqual({ source: "/plans", destination: "/pricing", permanent: true });
    expect(canonicalHeaders("/plans")).toEqual([]);
    expect(canonicalHeaders("/pricing")).toEqual(['<https://www.literaryworm.com/pricing>; rel="canonical"']);
  });
});
