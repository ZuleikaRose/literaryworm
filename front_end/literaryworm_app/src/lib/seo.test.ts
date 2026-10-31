import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { plans } from "../data/plans";
import { planPrices, plansDescription, siteDescription, structuredData } from "./seo";

const html = readFileSync(join(__dirname, "../../index.html"), "utf8");
const meta = (attr: string) => html.match(new RegExp(`<meta ${attr} content="([^"]*)"`))?.[1];

describe("search results", () => {
  it("names every plan's monthly price", () => {
    expect(planPrices()).toBe("Basic $9.99, Standard $14.99 or Premium $24.99 a month");
    expect(plansDescription()).toContain("Yearly: Basic $99.90, Standard $149.90, Premium $249.90.");
  });

  it("keeps index.html's description in step with the plans", () => {
    expect(meta('name="description"')).toBe(siteDescription());
    expect(meta('property="og:description"')).toBe(siteDescription());
  });

  it("keeps index.html's structured data in step with the plans", () => {
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(JSON.parse(ld ?? "null")).toEqual(structuredData());
    const offers = structuredData()[1].offers ?? [];
    expect(offers).toHaveLength(plans.length * 2);
    expect(offers.map((o) => o.price)).toEqual(["9.99", "99.90", "14.99", "149.90", "24.99", "249.90"]);
  });
});
