import { formatPrice, plans } from "../data/plans";

/** What search engines show for the site. index.html carries the same text and data (seo.test.ts checks). */
export const SITE_URL = "https://www.literaryworm.com";

/** "Basic $9.99, Standard $14.99 or Premium $24.99 a month" */
export const planPrices = () =>
  `${plans
    .map((p) => `${p.name} ${formatPrice(p.price)}`)
    .join(", ")
    .replace(/, ([^,]+)$/, " or $1")} a month`;

export const siteDescription = () =>
  `Read ebooks and listen to audiobooks in one place, with a profile for everyone at home. ${planPrices()}, or pay yearly and get two months free.`;

export const plansDescription = () =>
  `LiteraryWorm plans: ${planPrices()}. Yearly: ${plans.map((p) => `${p.name} ${formatPrice(p.yearlyPrice)}`).join(", ")}. Cancel online any time.`;

const offer = (name: string, price: number, duration: "P1M" | "P1Y") => ({
  "@type": "Offer",
  name,
  price: price.toFixed(2),
  priceCurrency: "USD",
  url: `${SITE_URL}/plans`,
  availability: "https://schema.org/InStock",
  priceSpecification: {
    "@type": "UnitPriceSpecification",
    price: price.toFixed(2),
    priceCurrency: "USD",
    billingDuration: duration,
    unitCode: duration === "P1M" ? "MON" : "ANN",
  },
});

/** The structured data in index.html: the site, and each plan's monthly and yearly price. */
export const structuredData = () => [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LiteraryWorm",
    url: `${SITE_URL}/`,
    description: siteDescription(),
  },
  {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "LiteraryWorm membership",
    description: "Ebooks and audiobooks with household profiles, billed monthly or yearly.",
    brand: { "@type": "Brand", name: "LiteraryWorm" },
    url: `${SITE_URL}/plans`,
    offers: plans.flatMap((p) => [
      offer(`${p.name}, monthly`, p.price, "P1M"),
      offer(`${p.name}, yearly`, p.yearlyPrice, "P1Y"),
    ]),
  },
];
