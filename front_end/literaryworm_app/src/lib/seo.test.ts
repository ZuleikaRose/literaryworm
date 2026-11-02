import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getBook } from "../data/books";
import { planFaqs, plans } from "../data/plans";
import { bookData, faqData, membershipData, planPrices, plansDescription, siteDescription, structuredData, absoluteUrl, bookRef, HOME_CRUMB, MEMBERSHIP_ID, pageData, personNode, seriesData, SITE_URL } from "./seo";

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

describe("each page's own structured data", () => {
  it("says what kind of page it is, that it's part of the site, and its trail from Home", () => {
    const page = pageData({
      type: "CollectionPage",
      path: "/whats-new",
      name: "What's new",
      crumbs: [HOME_CRUMB, { name: "What's new", path: "/whats-new" }],
      dateModified: "2026-11-02",
    });
    expect(page["@type"]).toBe("CollectionPage");
    expect(page["@id"]).toBe(`${SITE_URL}/whats-new#webpage`);
    expect(page.isPartOf).toEqual({ "@id": `${SITE_URL}/#website` });
    expect(page.breadcrumb?.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "What's new", item: `${SITE_URL}/whats-new` },
    ]);
    expect(page.dateModified).toBe("2026-11-02");
  });

  it("gives Home no trail and leaves out what it isn't given", () => {
    const home = pageData({ path: "/", name: "LiteraryWorm" });
    expect(home.url).toBe(`${SITE_URL}/`);
    expect(home["@type"]).toBe("WebPage");
    expect("breadcrumb" in home).toBe(false);
    expect("description" in home).toBe(false);
    expect("mainEntity" in home).toBe(false);
  });

  it("lists a series' books in reading order, linked to their own Book nodes", () => {
    const series = seriesData("Anne of Green Gables", "/series/Anne%20of%20Green%20Gables", [
      { id: "anne-of-green-gables", title: "Anne of Green Gables", author: "L. M. Montgomery" },
      { id: "anne-of-avonlea", title: "Anne of Avonlea", author: "L. M. Montgomery" },
    ]);
    expect(series["@type"]).toBe("BookSeries");
    expect(series.author).toEqual({ "@type": "Person", name: "L. M. Montgomery" });
    expect(series.hasPart.map((b) => [b.position, b["@id"]])).toEqual([
      [1, bookRef("anne-of-green-gables")["@id"]],
      [2, bookRef("anne-of-avonlea")["@id"]],
    ]);
    // The same @id as the book page's own Book.
    expect(bookRef("frankenstein")["@id"]).toBe(`${SITE_URL}/books/frankenstein#book`);
  });

  it("names a person by the page about them, and the membership by its id", () => {
    expect(personNode("Mary Shelley", "/authors/Mary%20Shelley")).toEqual({ "@type": "Person", name: "Mary Shelley", url: `${SITE_URL}/authors/Mary%20Shelley` });
    expect(membershipData()["@id"]).toBe(MEMBERSHIP_ID);
    expect(absoluteUrl("/plans")).toBe(`${SITE_URL}/plans`);
  });
});
