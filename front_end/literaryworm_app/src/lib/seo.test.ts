import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { plans } from "../data/plans";
import { planPrices, plansDescription, siteDescription, structuredData } from "./seo";

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

  it("keeps index.html's structured data in step with the plans", () => {
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    expect(JSON.parse(ld ?? "null")).toEqual(structuredData());
    const offers = structuredData()[1].offers ?? [];
    expect(offers).toHaveLength(plans.length * 2);
    expect(offers.map((o) => o.price)).toEqual(["15.00", "150.00", "20.00", "200.00", "30.00", "300.00"]);
  });
});
