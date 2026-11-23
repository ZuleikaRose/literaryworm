import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { browseGenres, genreHref, sampleCatalogGenres } from "../data/genres";
import { GENRE_LIST_MAX, GENRE_MIN_BOOKS, genreBooks, genreIndexable, genrePath, genreTitle, indexedGenres } from "./genrePages";
import { documentTitle, fileFor, prerenderedFiles, publicPageAt } from "./publicPages";
import { canonicalUrl, SITE_URL } from "./seo";
import { headerValues, redirectFor, rewriteFor, type VercelConfig } from "./vercelRoutes";

/**
 * Search Console listed Home's genre views (/?genre=antiques, ?genre=fiction, …) as "Alternate page
 * with proper canonical tag": they named Home as their canonical. Each genre now has its own page at
 * /genres/:id, built ahead with its own canonical, and the old addresses are redirected there.
 */
const read = (path: string) => readFileSync(join(__dirname, "../..", path), "utf8");
const vercel = JSON.parse(read("vercel.json")) as VercelConfig;
const sitemapUrls = new Set([...read("public/sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
const template = read("index.html");
const byFile = new Map(prerenderedFiles(template).map((f) => [f.file, f.html]));
const htmlFor = (path: string) => byFile.get(fileFor(path)) ?? "";
const canonicals = (html: string) => [...html.matchAll(/<link rel="canonical" href="([^"]*)" \/>/g)].map((m) => m[1]);
const noscriptLinks = (html: string) => [...(html.match(/<noscript>.*<\/noscript>/s)?.[0] ?? "").matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]);
const NOINDEX = '<meta name="robots" content="noindex" />';
const ids = browseGenres.map((g) => g.id);
const UNKNOWN_GENRE = "not-a-genre";

interface PageNode {
  "@type": string;
  url: string;
  breadcrumb: { itemListElement: { item: string }[] };
  mainEntity: { itemListElement: unknown[] };
}

describe("the old /?genre= addresses", () => {
  it("are redirected for good to each genre's own page", () => {
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => redirectFor(vercel, `/?genre=${id}`) !== `/genres/${id}`)).toEqual([]);
    const rule = vercel.redirects.find((r) => r.destination === "/genres/:genre");
    expect(rule?.permanent).toBe(true);
  });

  it("name exactly the app's genres, so a new genre can't be left on Home", () => {
    const rule = vercel.redirects.find((r) => r.destination === "/genres/:genre");
    const named = rule?.has?.[0]?.value?.match(/^\(\?<genre>(.*)\)$/)?.[1].split("|") ?? [];
    expect([...named].sort()).toEqual([...ids].sort());
  });

  it("keep their other query words out of the match, and a longer id never stops at a shorter one", () => {
    expect(redirectFor(vercel, "/?genre=young-adult-nonfiction")).toBe("/genres/young-adult-nonfiction");
    expect(redirectFor(vercel, "/?genre=young-adult")).toBe("/genres/young-adult");
    expect(redirectFor(vercel, "/?ref=ABC&genre=fantasy")).toBe("/genres/fantasy");
  });

  it("leave Home alone without a genre, with an empty one or one the app doesn't have", () => {
    expect(redirectFor(vercel, "/")).toBeNull();
    expect(redirectFor(vercel, "/?genre=")).toBeNull();
    expect(redirectFor(vercel, `/?genre=${UNKNOWN_GENRE}`)).toBeNull();
    expect(redirectFor(vercel, "/?genre=FANTASY")).toBeNull();
    expect(redirectFor(vercel, "/?ref=ABC")).toBeNull();
  });

  it("leave Home's own canonical as Home", () => {
    expect(canonicals(htmlFor("/"))).toEqual([`${SITE_URL}/`]);
    expect(headerValues(vercel, "/", "Link")).toEqual([`<${SITE_URL}/>; rel="canonical"`]);
  });
});

describe("genre pages", () => {
  it("are linked from the public pages at their own address, and members' Browse keeps its feed", () => {
    expect(genreHref("/", "fantasy")).toBe("/genres/fantasy");
    expect(genreHref("/", "technology")).toBe("/genres/technology");
    expect(genreHref("/browse", "fantasy")).toBe("/browse?genre=fantasy#discover");
    expect(genreHref("/browse", "technology")).toBe("/browse#discover");
  });

  it("are each built ahead, naming only themselves as canonical", () => {
    const wrong = ids.filter((id) => {
      const path = genrePath(id);
      return canonicals(htmlFor(path)).join() !== canonicalUrl(path) || publicPageAt(path)?.path !== path;
    });
    expect(wrong).toEqual([]);
  });

  it("are served only as built: an unknown genre is a real 404", () => {
    expect(rewriteFor(vercel, genrePath("fantasy"))).toBeNull();
    expect(rewriteFor(vercel, `/genres/${UNKNOWN_GENRE}`)).toBeNull();
    expect(byFile.has(fileFor(`/genres/${UNKNOWN_GENRE}`))).toBe(false);
  });

  it("are in the sitemap exactly when the catalog has titles in them for visitors", () => {
    const indexed = indexedGenres();
    expect(indexed.length).toBeGreaterThan(0);
    expect(ids.filter((id) => sitemapUrls.has(canonicalUrl(genrePath(id))) !== genreIndexable(id))).toEqual([]);
    expect(indexed.every((id) => genreBooks(id, "all").length >= GENRE_MIN_BOOKS)).toBe(true);
  });

  it("ask not to be indexed when the catalog has nothing in them, and never otherwise", () => {
    const empty = ids.filter((id) => sampleCatalogGenres[id].length === 0);
    expect(empty.length).toBeGreaterThan(0);
    expect(empty.filter((id) => !htmlFor(genrePath(id)).includes(NOINDEX))).toEqual([]);
    expect(indexedGenres().filter((id) => htmlFor(genrePath(id)).includes(NOINDEX))).toEqual([]);
  });

  it("have their own title and heading, and list their catalog titles as links to the book pages", () => {
    const fantasy = htmlFor(genrePath("fantasy"));
    expect(genreTitle("fantasy")).toBe("Fantasy books");
    expect(fantasy).toContain(`<title>${documentTitle("Fantasy books")}</title>`);
    expect(fantasy.match(/<h1>/g)).toHaveLength(1);
    const links = noscriptLinks(fantasy).filter((href) => href.startsWith("/books/"));
    const titles = genreBooks("fantasy", "all");
    expect(links).toEqual(titles.slice(0, GENRE_LIST_MAX).map((b) => `/books/${b.id}`));
  });

  it("describe themselves as a CollectionPage with a trail from Home and a list of their titles", () => {
    const html = htmlFor(genrePath("fiction"));
    const page = [...html.matchAll(/<script type="application\/ld\+json" data-prerendered>(.*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]) as PageNode)
      .find((n) => n["@type"] === "CollectionPage");
    expect(page?.url).toBe(`${SITE_URL}/genres/fiction`);
    expect(page?.breadcrumb.itemListElement.map((c) => c.item)).toEqual([`${SITE_URL}/`, `${SITE_URL}/genres/fiction`]);
    expect(page?.mainEntity.itemListElement.length).toBe(Math.min(genreBooks("fiction", "all").length, GENRE_LIST_MAX));
  });
});

describe("genreBooks", () => {
  it("finds nothing for a genre the catalog has no titles in", () => {
    expect(genreBooks("antiques", "all")).toEqual([]);
  });

  it("keeps Kids profiles to Kids titles", () => {
    const kids = genreBooks("fantasy", "kids");
    expect(kids.length).toBeLessThanOrEqual(genreBooks("fantasy", "all").length);
    expect(kids.every((b) => b.ageRating === "kids")).toBe(true);
  });
});
