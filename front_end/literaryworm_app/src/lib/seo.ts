import { formatPrice, plans } from "../data/plans";
import type { Book } from "../types";
import { isAligned } from "./alignment";

/**
 * What search engines show for the site. index.html carries the site-wide description and the
 * site-wide structured data (WebSite with its search, and Organization); seo.test.ts checks they
 * match. Page-specific data (the membership's plans and prices, the FAQ, a book) is added by the
 * page that shows it, through components/StructuredData.tsx, so no page claims what it doesn't show.
 */
export const SITE_URL = "https://www.literaryworm.com";
export const LOGO_URL = `${SITE_URL}/icons/icon-512.png`;
export const SUPPORT_EMAIL = "support@literaryworm.com";

/** "Basic $15.00, Standard $20.00 or Premium $30.00 a month" */
export const planPrices = () =>
  `${plans
    .map((p) => `${p.name} ${formatPrice(p.price)}`)
    .join(", ")
    .replace(/, ([^,]+)$/, " or $1")} a month`;

export const siteDescription = () =>
  `Read ebooks and listen to audiobooks in one place, with a profile for everyone at home. ${planPrices()}, or pay yearly and get two months free.`;

export const plansDescription = () =>
  `LiteraryWorm plans: ${planPrices()}. Yearly: ${plans.map((p) => `${p.name} ${formatPrice(p.yearlyPrice)}`).join(", ")}. Cancel online any time.`;

/** What the membership includes, for the Product's description (keep it true to the app). */
export const MEMBERSHIP_DESCRIPTION =
  "Ebooks and audiobooks with a profile for everyone at home: 877 public-domain classics to read in full and hear on LibriVox recordings, your own DRM-free EPUBs, book clubs and buddy reads, goals, moods and stats, Kids profiles with daily limits and bedtimes, and AI summaries, content notes and translations. Billed monthly or yearly.";

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/** The site, with its search (Search takes ?q=). */
const website = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: "LiteraryWorm",
  url: `${SITE_URL}/`,
  description: siteDescription(),
  inLanguage: "en",
  publisher: { "@id": ORGANIZATION_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    "query-input": "required name=search_term_string",
  },
});

/** Who runs it, and how to reach support. */
const organization = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: "LiteraryWorm",
  url: `${SITE_URL}/`,
  logo: LOGO_URL,
  email: SUPPORT_EMAIL,
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL, availableLanguage: "English" },
});

/** The structured data in index.html: only what's true on every page. */
export const structuredData = () => [website(), organization()];

/** Memberships are final: no refunds (the Return Policy). */
const noReturns = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "US",
  returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
};

const offer = (name: string, price: number, duration: "P1M" | "P1Y") => ({
  "@type": "Offer",
  name,
  price: price.toFixed(2),
  priceCurrency: "USD",
  url: `${SITE_URL}/plans`,
  availability: "https://schema.org/InStock",
  hasMerchantReturnPolicy: noReturns,
  priceSpecification: {
    "@type": "UnitPriceSpecification",
    price: price.toFixed(2),
    priceCurrency: "USD",
    billingDuration: duration,
    unitCode: duration === "P1M" ? "MON" : "ANN",
  },
});

export const MEMBERSHIP_ID = `${SITE_URL}/plans#membership`;

/** The membership and each plan's monthly and yearly price: on the home page and Plans. */
export const membershipData = () => ({
  "@context": "https://schema.org",
  "@type": "Product",
  "@id": MEMBERSHIP_ID,
  name: "LiteraryWorm membership",
  description: MEMBERSHIP_DESCRIPTION,
  image: LOGO_URL,
  brand: { "@type": "Brand", name: "LiteraryWorm" },
  url: `${SITE_URL}/plans`,
  offers: plans.flatMap((p) => [offer(`${p.name}, monthly`, p.price, "P1M"), offer(`${p.name}, yearly`, p.yearlyPrice, "P1Y")]),
});

/** The questions and answers a page shows, as an FAQPage (paragraph breaks become spaces). */
export const faqData = (faqs: readonly { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a.replace(/\n\n/g, " ") },
  })),
});

const LANGUAGE_CODES: Record<string, string> = { English: "en", French: "fr", German: "de", Spanish: "es", Italian: "it" };

/** A catalog book's page: the book, as an ebook and, with a recording, an audiobook. */
export function bookData(book: Pick<Book, "id" | "title" | "author" | "year" | "language" | "synopsis" | "pages" | "genres" | "recording" | "formats">) {
  const url = `${SITE_URL}/books/${encodeURIComponent(book.id)}`;
  const inLanguage = LANGUAGE_CODES[book.language] ?? "en";
  const editions: Record<string, unknown>[] = [];
  if (book.formats.includes("ebook")) {
    editions.push({ "@type": "Book", bookFormat: "https://schema.org/EBook", inLanguage, url, ...(book.pages > 0 ? { numberOfPages: book.pages } : {}) });
  }
  if (book.recording) {
    // The pilot's recordings are lined up with the text, so the player shows it sentence by sentence (lib/alignment.ts).
    const synced = isAligned(book.id) ? { accessibilityFeature: ["synchronizedAudioText"] } : {};
    editions.push({ "@type": "Audiobook", bookFormat: "https://schema.org/AudiobookFormat", inLanguage, url, readBy: { "@type": "Person", name: book.recording.narrator }, ...synced });
  }
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    "@id": `${url}#book`,
    name: book.title,
    author: { "@type": "Person", name: book.author },
    url,
    inLanguage,
    ...(book.year > 0 ? { datePublished: String(book.year) } : {}),
    ...(book.synopsis ? { description: book.synopsis } : {}),
    ...(book.genres.length ? { genre: book.genres } : {}),
    ...(editions.length ? { workExample: editions } : {}),
  };
}

/** An address on the site, absolute. */
export const absoluteUrl = (path: string) => (path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`);

/** One step of a page's breadcrumb trail: its name and path. */
export interface Crumb {
  name: string;
  path: string;
}

/** The trail from Home to a page, as a BreadcrumbList. */
export const breadcrumbData = (crumbs: Crumb[]) => ({
  "@type": "BreadcrumbList",
  itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: absoluteUrl(c.path) })),
});

/** The kinds of page the site has, from schema.org's WebPage types. */
export type PageType = "WebPage" | "CollectionPage" | "ProfilePage" | "SearchResultsPage" | "ItemPage";

export interface PageInfo {
  type?: PageType;
  /** The page's address: its path, with any query it shows (such as a search's words). */
  path: string;
  name: string;
  description?: string;
  /** From Home to this page; Home alone gets no trail. */
  crumbs?: Crumb[];
  /** When the page's content last changed (ISO date or timestamp). */
  dateModified?: string;
  /** What the page is about: a reference ({ "@id": … }) or a small node. */
  mainEntity?: Record<string, unknown>;
}

/**
 * Every public page's own node: what kind of page it is, its name and address, that it's part of
 * the site (WebSite in index.html), its breadcrumb trail and what it's about. Only what the page shows.
 */
export function pageData({ type = "WebPage", path, name, description, crumbs, dateModified, mainEntity }: PageInfo) {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#webpage`,
    url,
    name,
    inLanguage: "en",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    ...(description ? { description } : {}),
    ...(dateModified ? { dateModified } : {}),
    ...(crumbs && crumbs.length > 1 ? { breadcrumb: breadcrumbData(crumbs) } : {}),
    ...(mainEntity ? { mainEntity } : {}),
  };
}

/** The trail's first step. */
export const HOME_CRUMB: Crumb = { name: "Home", path: "/" };

/** A catalog book's node, by reference (bookData() gives it in full on the book's page). */
export const bookRef = (id: string) => ({ "@id": `${absoluteUrl(`/books/${encodeURIComponent(id)}`)}#book` });

/** A series page: the series and its books in reading order. */
export function seriesData(name: string, path: string, books: Pick<Book, "id" | "title" | "author">[]) {
  const url = absoluteUrl(path);
  const authors = [...new Set(books.map((b) => b.author))];
  return {
    "@context": "https://schema.org",
    "@type": "BookSeries",
    "@id": `${url}#series`,
    name,
    url,
    ...(authors.length === 1 ? { author: { "@type": "Person", name: authors[0] } } : {}),
    hasPart: books.map((b, i) => ({
      "@type": "Book",
      "@id": bookRef(b.id)["@id"],
      name: b.title,
      url: absoluteUrl(`/books/${encodeURIComponent(b.id)}`),
      author: { "@type": "Person", name: b.author },
      position: i + 1,
    })),
  };
}

/** A person a page is about: an author, a narrator or a reader who made their page public. */
export const personNode = (name: string, path: string) => ({ "@type": "Person", name, url: absoluteUrl(path) });
