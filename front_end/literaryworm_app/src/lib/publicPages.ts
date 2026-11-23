import { books } from "../data/books";
import { legalPages, type LegalPage } from "../data/legal";
import { FREE_TRIAL_DAYS, planFaqs } from "../data/plans";
import type { Book } from "../types";
import { builtInEntries, type ChangeEntry } from "./changelog";
import {
  absoluteUrl,
  bookData,
  bookRef,
  canonicalUrl,
  type Crumb,
  faqData,
  HOME_CRUMB,
  MEMBERSHIP_ID,
  membershipData,
  pageData,
  plansDescription,
  seriesData,
  siteDescription,
} from "./seo";
import { allSeries, type Series, seriesBooks, seriesPath, seriesPlace } from "./series";

/**
 * The pages search engines should index, each with its own title, description and structured data,
 * so every one of them can be served as its own HTML file at build time (the `prerender` plugin in
 * vite.config.ts) instead of one index.html for every address, which Google reported as "Duplicate
 * without user-selected canonical". The pages use the same titles, descriptions and structured data
 * once the app is running (useTitle, StructuredData), so what a crawler reads before and after
 * JavaScript agrees. public/sitemap.xml lists exactly these pages (publicPages.test.ts).
 */

/** A tab's title, as useTitle() sets it. */
export const documentTitle = (title: string) => (title ? `${title} · LiteraryWorm` : "LiteraryWorm");

/** Search results show about this much of a description. */
export const DESCRIPTION_MAX = 160;

/** A description cut to DESCRIPTION_MAX at a word, with an ellipsis when cut. */
export function shortDescription(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= DESCRIPTION_MAX) return flat;
  const cut = flat.slice(0, DESCRIPTION_MAX - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > DESCRIPTION_MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

export const HOME_TITLE = "Read and listen in one place";
export const PRICING_TITLE = "Pricing";
export const WHATS_NEW_TITLE = "What's new";
export const WHATS_NEW_DESCRIPTION = "Every new feature, fix and update on LiteraryWorm, newest first.";
export const SEARCH_TITLE = "Search";
export const SEARCH_DESCRIPTION =
  "Search LiteraryWorm's ebooks and audiobooks by title, author, keywords or ISBN, with filters for genre, language and length.";
export const SIGNUP_TITLE = "Create your account";
export const SIGNUP_DESCRIPTION = `Create a LiteraryWorm account to read ebooks and listen to audiobooks, with a profile for everyone at home. The first ${FREE_TRIAL_DAYS} days are free.`;
export const AFFILIATES_TITLE = "Affiliate program";
export const AFFILIATES_DESCRIPTION =
  "Recommend LiteraryWorm and earn 20% of each referred member's first payment as credit on your own membership.";

/** Home's own node. */
export const homePageNode = () => pageData({ path: "/", name: "LiteraryWorm: read and listen in one place", description: siteDescription() });

/** Pricing's own node: about the membership. */
export const pricingPageNode = () =>
  pageData({
    path: "/pricing",
    name: PRICING_TITLE,
    description: plansDescription(),
    crumbs: [HOME_CRUMB, { name: PRICING_TITLE, path: "/pricing" }],
    mainEntity: { "@id": MEMBERSHIP_ID },
  });

/** What's new's own node: the newest ten entries. */
export const whatsNewPageNode = (entries: ChangeEntry[]) =>
  pageData({
    type: "CollectionPage",
    path: "/whats-new",
    name: WHATS_NEW_TITLE,
    description: WHATS_NEW_DESCRIPTION,
    crumbs: [HOME_CRUMB, { name: WHATS_NEW_TITLE, path: "/whats-new" }],
    dateModified: entries[0]?.releasedOn,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: entries.slice(0, 10).map((e, i) => ({ "@type": "ListItem", position: i + 1, name: e.title })),
    },
  });

/** Search before anything is searched for (a search's results are never indexed). */
export const searchPageNode = () =>
  pageData({ path: "/search", name: SEARCH_TITLE, description: SEARCH_DESCRIPTION, crumbs: [HOME_CRUMB, { name: SEARCH_TITLE, path: "/search" }] });

export const signupPageNode = () =>
  pageData({ path: "/signup", name: SIGNUP_TITLE, description: SIGNUP_DESCRIPTION, crumbs: [HOME_CRUMB, { name: SIGNUP_TITLE, path: "/signup" }] });

export const affiliatesPageNode = () =>
  pageData({
    path: "/affiliates",
    name: AFFILIATES_TITLE,
    description: AFFILIATES_DESCRIPTION,
    crumbs: [HOME_CRUMB, { name: AFFILIATES_TITLE, path: "/affiliates" }],
  });

/** A footer page's description: its summary, cut for search results. */
export const legalDescription = (page: Pick<LegalPage, "title" | "summary">) =>
  shortDescription(page.summary || `LiteraryWorm's ${page.title}.`);

export const legalPageNode = (page: Pick<LegalPage, "slug" | "title" | "summary" | "updated">) =>
  pageData({
    path: `/legal/${page.slug}`,
    name: page.title,
    description: page.summary || undefined,
    dateModified: page.updated,
    crumbs: [HOME_CRUMB, { name: page.title, path: `/legal/${page.slug}` }],
  });

export const seriesTitle = (name: string) => `${name} (series)`;

export function seriesDescription(name: string, titles: Pick<Book, "title">[]): string {
  const count = titles.length === 1 ? "1 book" : `${titles.length} books`;
  return shortDescription(`${name}: ${count} on LiteraryWorm, in reading order: ${titles.map((b) => b.title).join(", ")}.`);
}

export const seriesPageNode = (name: string) =>
  pageData({
    type: "CollectionPage",
    path: seriesPath(name),
    name: seriesTitle(name),
    crumbs: [HOME_CRUMB, { name, path: seriesPath(name) }],
    mainEntity: { "@id": `${absoluteUrl(seriesPath(name))}#series` },
  });

const sameTitle = new Map<string, Book[]>();
for (const b of books) {
  const key = `${b.title} by ${b.author}`;
  sameTitle.set(key, [...(sameTitle.get(key) ?? []), b]);
}

/**
 * A book page's title: "Dune by Frank Herbert". Where the catalog has two editions of one book, the
 * edition too: its language, or else who reads it, or else its length, so no two book pages share a title.
 */
export function bookTitle(book: Pick<Book, "id" | "title" | "author" | "language" | "narrator" | "pages">): string {
  const base = `${book.title} by ${book.author}`;
  const editions = sameTitle.get(base) ?? [];
  if (editions.length < 2 || !editions.some((b) => b.id === book.id)) return base;
  const differ = (pick: (b: Pick<Book, "language" | "narrator" | "pages">) => unknown) => new Set(editions.map(pick)).size === editions.length;
  if (differ((b) => b.language)) return `${base} (in ${book.language})`;
  if (differ((b) => b.narrator)) return `${base} (read by ${book.narrator})`;
  return `${base} (${book.pages} pages)`;
}

export const bookDescription = (book: Pick<Book, "title" | "author" | "synopsis">) =>
  shortDescription(book.synopsis || `${book.title} by ${book.author}, to read and listen to on LiteraryWorm.`);

/** A book page's own node: an ItemPage about the book, with the trail through its series if it has one. */
export function bookPageNode({ id, title, mainEntity, inCatalog }: { id: string; title: string; mainEntity: Record<string, unknown>; inCatalog: boolean }) {
  const path = `/books/${encodeURIComponent(id)}`;
  const crumbs: Crumb[] = [HOME_CRUMB];
  const place = inCatalog ? seriesPlace(id) : null;
  if (place) crumbs.push({ name: place.series.name, path: seriesPath(place.series.name) });
  crumbs.push({ name: title, path });
  return pageData({ type: "ItemPage", path, name: title, crumbs, mainEntity });
}

/** One page to serve as its own HTML file. */
export interface PublicPage {
  /** Its path, as the sitemap spells it. */
  path: string;
  title: string;
  description: string;
  /** Its own schema.org nodes (index.html already has WebSite and Organization). */
  structured: unknown[];
}

const seriesPage = (series: Series): PublicPage => {
  // What a visitor sees: the books for every age.
  const titles = seriesBooks(series, "all");
  return {
    path: seriesPath(series.name),
    title: seriesTitle(series.name),
    description: seriesDescription(series.name, titles),
    structured: [seriesPageNode(series.name), seriesData(series.name, seriesPath(series.name), titles)],
  };
};

/** As the book page gives it: LiteraryWorm's own titles in full, the sample Google Books titles by name. */
const bookPage = (book: Book): PublicPage => {
  const own = book.source === "literaryworm";
  const mainEntity = own ? bookRef(book.id) : { "@type": "Book", name: book.title, author: [{ "@type": "Person", name: book.author }] };
  const node = bookPageNode({ id: book.id, title: book.title, mainEntity, inCatalog: own });
  return {
    path: `/books/${encodeURIComponent(book.id)}`,
    title: bookTitle(book),
    description: bookDescription(book),
    structured: own ? [bookData(book), node] : [node],
  };
};

/** Every page to index, in the sitemap's order. */
export function publicPages(): PublicPage[] {
  return [
    { path: "/", title: HOME_TITLE, description: siteDescription(), structured: [homePageNode(), membershipData(), faqData(planFaqs)] },
    { path: "/pricing", title: PRICING_TITLE, description: plansDescription(), structured: [pricingPageNode(), membershipData(), faqData(planFaqs)] },
    { path: "/whats-new", title: WHATS_NEW_TITLE, description: WHATS_NEW_DESCRIPTION, structured: [whatsNewPageNode(builtInEntries)] },
    { path: "/search", title: SEARCH_TITLE, description: SEARCH_DESCRIPTION, structured: [searchPageNode()] },
    { path: "/signup", title: SIGNUP_TITLE, description: SIGNUP_DESCRIPTION, structured: [signupPageNode()] },
    { path: "/affiliates", title: AFFILIATES_TITLE, description: AFFILIATES_DESCRIPTION, structured: [affiliatesPageNode()] },
    ...legalPages.map((p) => ({ path: `/legal/${p.slug}`, title: p.title, description: legalDescription(p), structured: [legalPageNode(p)] })),
    ...books.map(bookPage),
    ...allSeries.map(seriesPage),
  ];
}

/** The page at a path (any spelling of it), if it's one to index. */
export function publicPageAt(pathname: string, pages: PublicPage[] = publicPages()): PublicPage | undefined {
  const url = canonicalUrl(pathname);
  return pages.find((p) => canonicalUrl(p.path) === url);
}

/** Where a page's file goes in dist/: "/" is index.html, "/legal/terms" legal/terms.html (Vercel's cleanUrls). */
export function fileFor(path: string): string {
  if (path === "/") return "index.html";
  return `${decodeURIComponent(path.replace(/^\//, ""))}.html`;
}

/** The app's page for every other address the app answers (vercel.json rewrites to it as /shell, its clean address). */
export const SHELL_FILE = "shell.html";
/** What Vercel serves, with a 404, for an address the app doesn't have. */
export const NOT_FOUND_FILE = "404.html";

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** JSON that can't close its <script>. */
const scriptJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Replaces exactly one match, so a changed index.html fails the build instead of shipping wrong tags. */
function replaceOne(html: string, pattern: RegExp, replacement: string, what: string): string {
  const found = html.match(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`));
  if (found?.length !== 1) throw new Error(`index.html should have one ${what}, found ${found?.length ?? 0}`);
  return html.replace(pattern, replacement);
}

const metaPattern = (attr: "name" | "property", key: string) => new RegExp(`<meta ${attr}="${key}" content="[^"]*" />`);

function withHead(template: string, title: string, description: string): string {
  let html = replaceOne(template, /<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`, "<title>");
  html = replaceOne(html, metaPattern("name", "description"), `<meta name="description" content="${escapeHtml(description)}" />`, "description");
  html = replaceOne(html, metaPattern("property", "og:description"), `<meta property="og:description" content="${escapeHtml(description)}" />`, "og:description");
  html = replaceOne(html, metaPattern("property", "og:title"), `<meta property="og:title" content="${escapeHtml(title)}" />`, "og:title");
  return html;
}

/**
 * A page's own HTML, from the built index.html: its title and description (and Open Graph's), one
 * canonical link and og:url with its address, its structured data, and what it is for anyone without
 * JavaScript. The app takes over the head once it runs (main.tsx drops the page's data, which
 * StructuredData adds again).
 */
export function renderPage(template: string, page: PublicPage): string {
  const url = canonicalUrl(page.path);
  let html = withHead(template, documentTitle(page.title), page.description);
  html = replaceOne(
    html,
    metaPattern("property", "og:url"),
    `<meta property="og:url" content="${escapeHtml(url)}" />\n    <link rel="canonical" href="${escapeHtml(url)}" />`,
    "og:url",
  );
  const data = page.structured.map((d) => `    <script type="application/ld+json" data-prerendered>${scriptJson(d)}</script>\n`).join("");
  html = replaceOne(html, /\n\s*<\/head>/, `\n${data}  </head>`, "</head>");
  const noscript = `<noscript><main><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p><p><a href="/">LiteraryWorm</a></p></main></noscript>`;
  return replaceOne(html, /<div id="root"><\/div>/, `<div id="root"></div>\n    ${noscript}`, "#root");
}

/**
 * The app's page for addresses not built ahead (members' pages, authors, Google Books titles):
 * no og:url or canonical, which would name one page for all of them. components/Canonical.tsx sets
 * both as soon as the app starts, and vercel.json's Link headers give the public ones theirs.
 */
export function renderShell(template: string): string {
  return replaceOne(template, /\n\s*<meta property="og:url" content="[^"]*" \/>/, "", "og:url");
}

/** The not-found page: the app (which shows its own not-found page), never indexed. */
export function renderNotFound(template: string): string {
  let html = withHead(renderShell(template), documentTitle("Page not found"), "This page isn't on LiteraryWorm's shelves.");
  html = replaceOne(html, /<meta name="viewport"/, `<meta name="robots" content="noindex" />\n    <meta name="viewport"`, "viewport");
  return html;
}

/** What the dev server answers for a path: the page's own HTML, or the shell. */
export function renderFor(template: string, pathname: string): string {
  const page = publicPageAt(pathname);
  return page ? renderPage(template, page) : renderShell(template);
}

/** Every file the build adds or replaces in dist/, from the built index.html. */
export function prerenderedFiles(template: string): { file: string; html: string }[] {
  return [
    ...publicPages().map((page) => ({ file: fileFor(page.path), html: renderPage(template, page) })),
    { file: SHELL_FILE, html: renderShell(template) },
    { file: NOT_FOUND_FILE, html: renderNotFound(template) },
  ];
}
