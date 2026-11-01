import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getBook } from "../data/books";
import { planFaqs, plans } from "../data/plans";
import { bookData, faqData, membershipData, planPrices, plansDescription, siteDescription, structuredData } from "./seo";

const html = readFileSync(join(__dirname, "../../index.html"), "utf8");
const meta = (attr: string) => html.match(new RegExp(`<meta ${attr} content="([^"]*)"`))?.[1];

describe("search results", () => {
  it("names every plan's monthly price", () => {
    expect(planPrices()).toBe("Basic $15.00, Standard $20.00 or Premium $30.00 a month");
    expect(plansDescription()).toContain("Yearly: Basic $150.00, Standard $200.00, Premium $300.00.");
  });

  it("keeps index.html's description in step with the plans", () => {
    expect(meta('name="description"')).toBe(siteDescription());
    expect(meta('property="og:description"')).toBe(siteDescription());
  });

  it("keeps index.html's structured data to what's true on every page: the site and who runs it", () => {
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(JSON.parse(ld ?? "null")).toEqual(structuredData());
    expect(structuredData().map((d) => d["@type"])).toEqual(["WebSite", "Organization"]);
    // The membership and its prices are only on the pages that show them.
    expect(html).not.toContain('"Product"');
    const site = structuredData()[0] as { potentialAction?: { target: { urlTemplate: string } } };
    expect(site.potentialAction?.target.urlTemplate).toBe("https://www.literaryworm.com/search?q={search_term_string}");
  });
});

describe("page structured data", () => {
  it("lists each plan's monthly and yearly offer, with an image and no returns", () => {
    const product = membershipData();
    expect(product.image).toMatch(/^https:\/\/www\.literaryworm\.com\//);
    expect(product.offers).toHaveLength(plans.length * 2);
    expect(product.offers.map((o) => o.price)).toEqual(["15.00", "150.00", "20.00", "200.00", "30.00", "300.00"]);
    expect(product.offers[0].hasMerchantReturnPolicy.returnPolicyCategory).toBe("https://schema.org/MerchantReturnNotPermitted");
  });

  it("turns the FAQ into questions and answers, paragraph breaks as spaces", () => {
    const faq = faqData(planFaqs);
    expect(faq.mainEntity).toHaveLength(planFaqs.length);
    expect(faq.mainEntity.every((q) => q.name.endsWith("?") && !q.acceptedAnswer.text.includes("\n"))).toBe(true);
  });

  it("describes a catalog book, with its ebook and its LibriVox audiobook", () => {
    const book = getBook("frankenstein")!;
    const data = bookData(book) as unknown as Record<string, unknown> & { workExample: { "@type": string; readBy?: { name: string } }[] };
    expect(data["@type"]).toBe("Book");
    expect(data.name).toBe(book.title);
    expect(data.url).toBe("https://www.literaryworm.com/books/frankenstein");
    expect(data.workExample.map((w) => w["@type"])).toEqual(["Book", "Audiobook"]);
    expect(data.workExample[1].readBy?.name).toBe(book.recording!.narrator);
  });

  it("gives a book in another language its language code", () => {
    expect(bookData(getBook("candide-fr")!).inLanguage).toBe("fr");
    expect(bookData(getBook("frankenstein")!).inLanguage).toBe("en");
  });
});
