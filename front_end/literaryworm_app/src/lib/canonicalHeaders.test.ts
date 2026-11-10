import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalUrl } from "./seo";

/**
 * Every route is served the same index.html, so without JavaScript every public page looks alike
 * and Google reports "Duplicate without user-selected canonical". vercel.json sends each public page's
 * canonical as an HTTP `Link` header, which Google reads before rendering. These checks keep those
 * rules in step with the sitemap and with canonicalUrl() (what components/Canonical.tsx sets).
 */
type HeaderRule = { source: string; headers: { key: string; value: string }[] };
const vercel = JSON.parse(readFileSync(join(__dirname, "../../vercel.json"), "utf8")) as {
  headers: HeaderRule[];
  redirects?: { source: string; destination: string; permanent: boolean }[];
};
const sitemap = readFileSync(join(__dirname, "../../public/sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

/** The two shapes the rules use: `:name(a|b)` and `:name` (one path segment), as Vercel reads them. */
function compile(source: string): RegExp {
  const pattern = source
    .replace(/:(\w+)\(([^)]+)\)/g, "(?<$1>$2)")
    .replace(/:(\w+)(?![\w(])/g, "(?<$1>[^/]+?)");
  return new RegExp(`^${pattern}$`);
}

/** The canonical the headers give a path, or every one when more than one rule matches. */
function canonicalHeaders(path: string): string[] {
  return vercel.headers.flatMap((rule) => {
    const match = path.match(compile(rule.source));
    if (!match) return [];
    return rule.headers
      .filter((h) => h.key === "Link")
      .map((h) => h.value.replace(/:(\w+)/g, (all, name: string) => match.groups?.[name] ?? all));
  });
}

describe("canonical Link headers (vercel.json)", () => {
  it("give every page in the sitemap exactly one canonical: its own address", () => {
    expect(sitemapUrls.length).toBeGreaterThan(100);
    const wrong = sitemapUrls.filter((url) => {
      const path = new URL(url).pathname;
      const headers = canonicalHeaders(path);
      return headers.length !== 1 || headers[0] !== `<${canonicalUrl(path)}>; rel="canonical"` || canonicalUrl(path) !== url;
    });
    expect(wrong).toEqual([]);
  });

  it("leave members-only routes and files alone", () => {
    for (const path of ["/library", "/account", "/read/dune", "/listen/dune", "/clubs/abc", "/sitemap.xml", "/assets/index.js"]) {
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
