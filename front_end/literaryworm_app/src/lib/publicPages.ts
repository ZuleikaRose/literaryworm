import { books } from "../data/books";
import { type BrowseGenre, browseGenres, genreLabel } from "../data/genres";
import { legalPages, type LegalPage } from "../data/legal";
import { FREE_TRIAL_DAYS, planFaqs } from "../data/plans";
import type { Book } from "../types";
import { builtInEntries, type ChangeEntry } from "./changelog";
import { GENRE_LIST_MAX, genreBooks, genreIndexable, genrePath, genreTitle, indexedGenres } from "./genrePages";
import { catalogBy, type PersonKind, personName, personPath } from "./people";
import {
  absoluteUrl,
  bookData,
  bookPath,
  bookRef,
  canonicalUrl,
  type Crumb,
  faqData,
  HOME_CRUMB,
  MEMBERSHIP_ID,
  membershipData,
  pageData,
  personNode,
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
  const path = bookPath(id);
  const crumbs: Crumb[] = [HOME_CRUMB];
  const place = inCatalog ? seriesPlace(id) : null;
  if (place) crumbs.push({ name: place.series.name, path: seriesPath(place.series.name) });
  crumbs.push({ name: title, path });
  return pageData({ type: "ItemPage", path, name: title, crumbs, mainEntity });
}

/** "Dune, Emma and Persuasion": the first few titles of a list, for a description. */
function someTitles(titles: Pick<Book, "title">[], max = 3): string {
  const names = titles.slice(0, max).map((b) => b.title);
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const countOf = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A genre page's description: what the catalog has in it, or, with nothing, what Google Books adds. */
export function genreDescription(id: BrowseGenre, titles: Pick<Book, "title">[]): string {
  const label = genreLabel(id);
  if (titles.length === 0) return shortDescription(`${label} books from Google Books on LiteraryWorm: browse, save and rate them, with a profile for everyone at home.`);
  return shortDescription(
    `${label} books on LiteraryWorm: ${countOf(titles.length, "title", "titles")} to read and listen to, including ${someTitles(titles)}. More from Google Books, with a profile for everyone at home.`,
  );
}

/** A genre page's own node: a CollectionPage listing the catalog's titles in it. */
export function genrePageNode(id: BrowseGenre, titles: Pick<Book, "id" | "title">[]) {
  const path = genrePath(id);
  return pageData({
    type: "CollectionPage",
    path,
    name: genreTitle(id),
    description: genreDescription(id, titles),
    crumbs: [HOME_CRUMB, { name: genreTitle(id), path }],
    ...(titles.length > 0 && {
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: Math.min(titles.length, GENRE_LIST_MAX),
        itemListElement: titles.slice(0, GENRE_LIST_MAX).map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.title, url: absoluteUrl(bookPath(b.id)) })),
      },
    }),
  });
}

/** A narrator's page is indexed once they read at least this many catalog titles (one is too thin a page). */
export const NARRATOR_MIN_TITLES = 2;

/** An author's or narrator's page title: "Jane Austen (author)". */
export const personTitle = (kind: PersonKind, name: string) => `${name} (${kind})`;

/** A person page's description, from the catalog titles a visitor sees. */
export function personDescription(kind: PersonKind, name: string, titles: Pick<Book, "title">[]): string {
  if (titles.length === 0) return shortDescription(`Books by ${name} from Google Books: save them, rate them and follow ${name} on LiteraryWorm.`);
  const count = countOf(titles.length, "title", "titles");
  return shortDescription(
    kind === "author"
      ? `${name} on LiteraryWorm: ${count} to read and listen to, including ${someTitles(titles)}.`
      : `Audiobooks read by ${name} on LiteraryWorm: ${count}, including ${someTitles(titles)}.`,
  );
}

/** Whether a person's page should be in search results: authors always, narrators with NARRATOR_MIN_TITLES. */
export const personIndexable = (kind: PersonKind, name: string) => kind === "author" || catalogBy(kind, name, "all").length >= NARRATOR_MIN_TITLES;

/** A person page's own node: a ProfilePage about them. */
export function personPageNode(kind: PersonKind, name: string) {
  const path = personPath(kind, name);
  return pageData({
    type: "ProfilePage",
    path,
    name: personTitle(kind, name),
    description: personDescription(kind, name, catalogBy(kind, name, "all")),
    crumbs: [HOME_CRUMB, { name, path }],
    mainEntity: personNode(name, path),
  });
}

/** A link a page gives readers without JavaScript (and crawlers reading the HTML before it runs). */
export interface PageLink {
  name: string;
  path: string;
}

/** One page to serve as its own HTML file. */
export interface PublicPage {
  /** Its path, as the sitemap spells it. */
  path: string;
  title: string;
  description: string;
  /** Its own schema.org nodes (index.html already has WebSite and Organization). */
  structured: unknown[];
  /** Pages it links to, written into its HTML for readers without JavaScript and for crawlers. */
  links?: PageLink[];
  /** Built so its address is right, but kept out of search results and the sitemap (a thin page). */
  noindex?: boolean;
}

const bookLink = (b: Pick<Book, "id" | "title">): PageLink => ({ name: b.title, path: bookPath(b.id) });

const seriesPage = (series: Series): PublicPage => {
  // What a visitor sees: the books for every age.
  const titles = seriesBooks(series, "all");
  return {
    path: seriesPath(series.name),
    title: seriesTitle(series.name),
    description: seriesDescription(series.name, titles),
    structured: [seriesPageNode(series.name), seriesData(series.name, seriesPath(series.name), titles)],
    links: titles.map(bookLink),
  };
};

const genrePage = (id: BrowseGenre): PublicPage => {
  const titles = genreBooks(id, "all");
  return {
    path: genrePath(id),
    title: genreTitle(id),
    description: genreDescription(id, titles),
    structured: [genrePageNode(id, titles)],
    links: titles.slice(0, GENRE_LIST_MAX).map(bookLink),
    ...(!genreIndexable(id) && { noindex: true }),
  };
};

/** The catalog's authors and narrators, each once, as their pages spell them. */
function catalogPeople(kind: PersonKind): string[] {
  const names = new Set(books.map((b) => (kind === "author" ? b.author : b.narrator)).filter((n): n is string => Boolean(n)));
  // Only names the page would take as they are (personName()), and none with a "/" (it would be a folder in dist/).
  return [...names].filter((n) => personName(n) === n && !n.includes("/"));
}

const personPage = (kind: PersonKind, name: string): PublicPage => {
  const titles = catalogBy(kind, name, "all");
  return {
    path: personPath(kind, name),
    title: personTitle(kind, name),
    description: personDescription(kind, name, titles),
    structured: [personPageNode(kind, name)],
    links: titles.map(bookLink),
    ...(!personIndexable(kind, name) && { noindex: true }),
  };
};

/** As the book page gives it: LiteraryWorm's own titles in full, the sample Google Books titles by name. */
const bookPage = (book: Book): PublicPage => {
  const own = book.source === "literaryworm";
  const mainEntity = own ? bookRef(book.id) : { "@type": "Book", name: book.title, author: [{ "@type": "Person", name: book.author }] };
  const node = bookPageNode({ id: book.id, title: book.title, mainEntity, inCatalog: own });
  const place = own ? seriesPlace(book.id) : null;
  return {
    path: bookPath(book.id),
    title: bookTitle(book),
    description: bookDescription(book),
    structured: own ? [bookData(book), node] : [node],
    links: [
      { name: book.author, path: personPath("author", book.author) },
      ...(book.narrator ? [{ name: `Read by ${book.narrator}`, path: personPath("narrator", book.narrator) }] : []),
      ...(place ? [{ name: `${place.series.name} (series)`, path: seriesPath(place.series.name) }] : []),
    ],
  };
};

/** Every page built ahead, in the sitemap's order (indexedPages() leaves out the ones marked noindex). */
export function publicPages(): PublicPage[] {
  const homeLinks: PageLink[] = [
    { name: PRICING_TITLE, path: "/pricing" },
    ...indexedGenres().map((id) => ({ name: genreTitle(id), path: genrePath(id) })),
  ];
  return [
    { path: "/", title: HOME_TITLE, description: siteDescription(), structured: [homePageNode(), membershipData(), faqData(planFaqs)], links: homeLinks },
    { path: "/pricing", title: PRICING_TITLE, description: plansDescription(), structured: [pricingPageNode(), membershipData(), faqData(planFaqs)] },
    { path: "/whats-new", title: WHATS_NEW_TITLE, description: WHATS_NEW_DESCRIPTION, structured: [whatsNewPageNode(builtInEntries)] },
    { path: "/search", title: SEARCH_TITLE, description: SEARCH_DESCRIPTION, structured: [searchPageNode()] },
    { path: "/signup", title: SIGNUP_TITLE, description: SIGNUP_DESCRIPTION, structured: [signupPageNode()] },
    { path: "/affiliates", title: AFFILIATES_TITLE, description: AFFILIATES_DESCRIPTION, structured: [affiliatesPageNode()] },
    ...legalPages.map((p) => ({ path: `/legal/${p.slug}`, title: p.title, description: legalDescription(p), structured: [legalPageNode(p)] })),
    ...books.map(bookPage),
    ...allSeries.map(seriesPage),
    ...browseGenres.map((g) => genrePage(g.id)),
    ...catalogPeople("author").map((name) => personPage("author", name)),
    ...catalogPeople("narrator").map((name) => personPage("narrator", name)),
  ];
}

/** The pages for search engines: the sitemap's list. */
export const indexedPages = (pages: PublicPage[] = publicPages()) => pages.filter((p) => !p.noindex);

/**
 * public/sitemap.xml (scripts/build-sitemap.mjs writes it; publicPages.test.ts checks it's current).
 * A lastmod only where the date is known: a footer page's is the day its text last changed. Other
 * pages have none rather than a guess (a build date on every page teaches search engines to ignore it;
 * What's new and Home also change from the database, after any date the repository knows).
 */
export function sitemapXml(pages: PublicPage[] = indexedPages()): string {
  const updated = new Map(legalPages.map((p) => [`/legal/${p.slug}`, p.updated]));
  const lastmod = (path: string) => updated.get(path);
  const lines = pages.map((p) => {
    const when = lastmod(p.path);
    return `  <url><loc>${escapeHtml(canonicalUrl(p.path))}</loc>${when ? `<lastmod>${when}</lastmod>` : ""}</url>`;
  });
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...lines, "</urlset>", ""].join("\n");
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
  if (page.noindex) html = replaceOne(html, /<meta name="viewport"/, `<meta name="robots" content="noindex" />\n    <meta name="viewport"`, "viewport");
  const links = page.links?.length
    ? `<ul>${page.links.map((l) => `<li><a href="${escapeHtml(l.path)}">${escapeHtml(l.name)}</a></li>`).join("")}</ul>`
    : "";
  const noscript = `<noscript><main><h1>${escapeHtml(page.title)}</h1><p>${escapeHtml(page.description)}</p>${links}<p><a href="/">LiteraryWorm</a></p></main></noscript>`;
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
