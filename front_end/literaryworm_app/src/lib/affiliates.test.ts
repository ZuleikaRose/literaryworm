import { describe, expect, it } from "@jest/globals";
import { affiliateLink, type Application, applicationErrors, CHANNELS_MAX, CHANNELS_MIN, cleanAffiliateCode, commissionCents } from "./affiliates";

const good: Application = {
  website: "https://booksbyalex.example",
  channels: "My reading newsletter and a weekly video of what I'm reading.",
  disclosesCommission: true,
  noMarketingToChildren: true,
  acceptsTerms: true,
};

describe("cleanAffiliateCode", () => {
  it("accepts ten characters from the code alphabet, in either case", () => {
    expect(cleanAffiliateCode("abcdefgh23")).toBe("ABCDEFGH23");
    expect(cleanAffiliateCode(" ABCDEFGH23 ")).toBe("ABCDEFGH23");
  });

  it("refuses invitation codes, look-alike characters and anything else", () => {
    expect(cleanAffiliateCode("AVERY234")).toBeNull();
    expect(cleanAffiliateCode("ABCDEFGHI1")).toBeNull();
    expect(cleanAffiliateCode("ABCDEFGH234")).toBeNull();
    expect(cleanAffiliateCode("")).toBeNull();
    expect(cleanAffiliateCode(null)).toBeNull();
  });
});

describe("affiliateLink", () => {
  it("is the sign-up page with the code", () => {
    expect(affiliateLink("ABCDEFGH23", "https://www.literaryworm.com")).toBe("https://www.literaryworm.com/signup?aff=ABCDEFGH23");
  });
});

describe("commissionCents", () => {
  it("is 20% of the first payment, rounded down", () => {
    expect(commissionCents(1500)).toBe(300);
    expect(commissionCents(2000)).toBe(400);
    expect(commissionCents(15000)).toBe(3000);
    expect(commissionCents(1499)).toBe(299);
  });

  it("is nothing for nothing paid", () => {
    expect(commissionCents(0)).toBe(0);
    expect(commissionCents(-100)).toBe(0);
  });
});

describe("applicationErrors", () => {
  it("has none for a complete application", () => {
    expect(applicationErrors(good)).toEqual({});
  });

  it("needs an https address", () => {
    expect(applicationErrors({ ...good, website: "http://booksbyalex.example" }).website).toBeDefined();
    expect(applicationErrors({ ...good, website: "booksbyalex.example" }).website).toBeDefined();
    expect(applicationErrors({ ...good, website: "https://a b" }).website).toBeDefined();
  });

  it("needs 10 to 500 characters about the channels, at both edges", () => {
    expect(applicationErrors({ ...good, channels: "x".repeat(CHANNELS_MIN) }).channels).toBeUndefined();
    expect(applicationErrors({ ...good, channels: "x".repeat(CHANNELS_MIN - 1) }).channels).toBeDefined();
    expect(applicationErrors({ ...good, channels: "x".repeat(CHANNELS_MAX) }).channels).toBeUndefined();
    expect(applicationErrors({ ...good, channels: "x".repeat(CHANNELS_MAX + 1) }).channels).toBeDefined();
  });

  it("needs all three agreements (story 84)", () => {
    expect(Object.keys(applicationErrors({ ...good, acceptsTerms: false, disclosesCommission: false, noMarketingToChildren: false })).sort()).toEqual([
      "acceptsTerms",
      "disclosesCommission",
      "noMarketingToChildren",
    ]);
  });
});
