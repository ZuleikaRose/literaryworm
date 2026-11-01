import { formatPrice, plans } from "../data/plans";
import type { Book } from "../types";

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

/** The membership and each plan's monthly and yearly price: on the home page and Plans. */
export const membershipData = () => ({
  "@context": "https://schema.org",
  "@type": "Product",
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
    editions.push({ "@type": "Audiobook", bookFormat: "https://schema.org/AudiobookFormat", inLanguage, url, readBy: { "@type": "Person", name: book.recording.narrator } });
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
