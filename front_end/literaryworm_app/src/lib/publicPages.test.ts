import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getBook } from "../data/books";
import {
  bookTitle,
  DESCRIPTION_MAX,
  documentTitle,
  fileFor,
  NOT_FOUND_FILE,
  prerenderedFiles,
  publicPageAt,
  publicPages,
  renderFor,
  renderPage,
  SHELL_FILE,
  shortDescription,
} from "./publicPages";
import { canonicalUrl, plansDescription, SITE_URL, siteDescription } from "./seo";

/**
 * Every page in the sitemap is built as its own HTML file (vite.config.ts's prerender plugin runs
 * prerenderedFiles() on the built index.html, which differs from the source one only in its asset
 * tags). Google reported "Duplicate without user-selected canonical" while every address was served
 * the same index.html; these checks keep each page's file its own.
 */
const template = readFileSync(join(__dirname, "../../index.html"), "utf8");
const sitemap = readFileSync(join(__dirname, "../../public/sitemap.xml"), "utf8");
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const files = prerenderedFiles(template);
const byFile = new Map(files.map((f) => [f.file, f.html]));
const MIN_SITEMAP_URLS = 900;

const canonicals = (html: string) => [...html.matchAll(/<link rel="canonical" href="([^"]*)" \/>/g)].map((m) => m[1]);
const ogUrls = (html: string) => [...html.matchAll(/<meta property="og:url" content="([^"]*)" \/>/g)].map((m) => m[1]);
const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1];
const descriptionOf = (html: string) => html.match(/<meta name="description" content="([^"]*)" \/>/)?.[1];
const pageData = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json" data-prerendered>(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]) as Record<string, unknown>);
const decodeHtml = (text: string) => text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
/** The built HTML for a sitemap address. */
const htmlFor = (url: string) => byFile.get(fileFor(new URL(url).pathname)) ?? "";

describe("the pages built ahead", () => {
  it("are exactly the sitemap's pages", () => {
    expect(sitemapUrls.length).toBeGreaterThan(MIN_SITEMAP_URLS);
    const built = publicPages().map((p) => canonicalUrl(p.path));
    expect([...built].sort()).toEqual([...sitemapUrls].sort());
    expect(new Set(built).size).toBe(built.length);
  });

  it("each have exactly one canonical link and one og:url, both their own address", () => {
    const wrong = sitemapUrls.filter((url) => {
      const html = htmlFor(url);
      const c = canonicals(html);
      const og = ogUrls(html);
      return c.length !== 1 || c[0] !== url || og.length !== 1 || og[0] !== url;
    });
    expect(wrong).toEqual([]);
  });

  it("name addresses on the site's own host, with no query and no trailing slash", () => {
    const wrong = sitemapUrls.filter((url) => {
      const parsed = new URL(url);
      return parsed.origin !== SITE_URL || parsed.search !== "" || (parsed.pathname !== "/" && parsed.pathname.endsWith("/"));
    });
    expect(wrong).toEqual([]);
  });

  it("each have a title no other page has", () => {
    const titles = sitemapUrls.map((url) => titleOf(htmlFor(url)));
    const repeated = titles.filter((t, i) => titles.indexOf(t) !== i);
    expect(titles.every((t) => t && t.endsWith(" · LiteraryWorm"))).toBe(true);
    expect(repeated).toEqual([]);
  });

  it("each have a description, cut to fit search results (Home and Pricing keep the site's own, seo.test.ts)", () => {
    const siteWide = new Set([siteDescription(), plansDescription()]);
    const wrong = sitemapUrls.filter((url) => {
      const d = decodeHtml(descriptionOf(htmlFor(url)) ?? "");
      return d.length === 0 || (d.length > DESCRIPTION_MAX && !siteWide.has(d));
    });
    expect(wrong).toEqual([]);
  });

  it("each describe themselves in structured data at their own address", () => {
    const wrong = sitemapUrls.filter((url) => {
      const nodes = pageData(htmlFor(url));
      const page = nodes.find((n) => String(n["@id"]).endsWith("#webpage"));
      return !page || page.url !== url || page["@id"] !== `${url}#webpage`;
    });
    expect(wrong).toEqual([]);
  });

  it("keep the site-wide structured data and the app's script", () => {
    const html = htmlFor(`${SITE_URL}/pricing`);
    expect(html).toContain('"@type": "WebSite"');
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(html).toContain('<div id="root"></div>');
  });

  it("tell readers without JavaScript what the page is", () => {
    expect(htmlFor(`${SITE_URL}/books/dune`)).toMatch(/<noscript><main><h1>Dune by Frank Herbert<\/h1><p>[^<]+<\/p>/);
  });

  it("put Home in index.html and each other page in its own file", () => {
    expect(fileFor("/")).toBe("index.html");
    expect(fileFor("/legal/terms")).toBe("legal/terms.html");
    expect(fileFor("/series/Aunt%20Jane's%20Nieces")).toBe("series/Aunt Jane's Nieces.html");
    expect(canonicals(byFile.get("index.html") ?? "")).toEqual([`${SITE_URL}/`]);
    expect(new Set(files.map((f) => f.file)).size).toBe(files.length);
  });
});

describe("the other files", () => {
  it("serve the app at other addresses without naming any page as theirs", () => {
    const shell = byFile.get(SHELL_FILE) ?? "";
    expect(canonicals(shell)).toEqual([]);
    expect(ogUrls(shell)).toEqual([]);
    expect(titleOf(shell)).toBe("LiteraryWorm");
    expect(shell).not.toContain("noindex");
  });

  it("keep the not-found page out of search results", () => {
    const notFound = byFile.get(NOT_FOUND_FILE) ?? "";
    expect(notFound).toContain('<meta name="robots" content="noindex" />');
    expect(canonicals(notFound)).toEqual([]);
    expect(titleOf(notFound)).toBe("Page not found · LiteraryWorm");
  });
});

describe("publicPageAt", () => {
  it("finds a page however its address is spelled", () => {
    expect(publicPageAt("/pricing/")?.path).toBe("/pricing");
    expect(publicPageAt("/series/Aunt%20Jane%27s%20Nieces")?.title).toBe("Aunt Jane's Nieces (series)");
    expect(publicPageAt("")?.path).toBe("/");
  });

  it("finds nothing for addresses that aren't built ahead", () => {
    expect(publicPageAt("/authors/Jane%20Austen")).toBeUndefined();
    expect(publicPageAt("/books/not-a-book")).toBeUndefined();
    expect(publicPageAt("/account")).toBeUndefined();
  });

  it("gives the dev server a page's own head, and the shell elsewhere", () => {
    expect(canonicals(renderFor(template, "/legal/terms"))).toEqual([`${SITE_URL}/legal/terms`]);
    expect(canonicals(renderFor(template, "/library"))).toEqual([]);
  });
});

describe("bookTitle", () => {
  it("names the book and its author", () => {
    expect(bookTitle(getBook("dune")!)).toBe("Dune by Frank Herbert");
  });

  it("tells two editions of one book apart", () => {
    expect(bookTitle(getBook("madame-bovary")!)).toBe("Madame Bovary by Gustave Flaubert (in English)");
    expect(bookTitle(getBook("madame-bovary-fr")!)).toBe("Madame Bovary by Gustave Flaubert (in French)");
    expect(bookTitle(getBook("pinocchio")!)).not.toBe(bookTitle(getBook("the-adventures-of-pinocchio")!));
  });
});

describe("shortDescription", () => {
  const LONG_WORD_COUNT = 60;

  it("keeps a short description as it is, with its spaces tidied", () => {
    expect(shortDescription("")).toBe("");
    expect(shortDescription("  A  book\nabout   things. ")).toBe("A book about things.");
  });

  it("keeps one exactly at the limit, and cuts a longer one at a word", () => {
    const exact = "a".repeat(DESCRIPTION_MAX);
    expect(shortDescription(exact)).toBe(exact);
    const long = Array.from({ length: LONG_WORD_COUNT }, () => "word").join(" ");
    const cut = shortDescription(long);
    expect(cut.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(cut).toMatch(/word…$/);
  });
});

describe("renderPage", () => {
  const PAGE = { path: "/x", title: 'A <b> & "c"', description: "d", structured: [{ name: "</script><script>alert(1)</script>" }] };

  it("escapes what it writes into the page", () => {
    const html = renderPage(template, PAGE);
    expect(titleOf(html)).toBe(`${documentTitle("A &lt;b&gt; &amp; &quot;c&quot;")}`);
    expect(html).not.toContain("</script><script>alert(1)");
    expect(pageData(html)).toEqual([{ name: "</script><script>alert(1)</script>" }]);
  });

  it("refuses an index.html without the tags it fills in, rather than build a page without them", () => {
    expect(() => renderPage(template.replace(/<title>[^<]*<\/title>/, ""), PAGE)).toThrow("<title>");
    expect(() => renderPage(template.replace(/<meta property="og:url"[^>]*>/, ""), PAGE)).toThrow("og:url");
  });
});
