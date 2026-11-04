import { beforeEach, describe, expect, it } from "@jest/globals";
import { type AnalyticsTag, analyticsAllowed, applyAnalytics, pageLocation, resetAnalyticsKey } from "./analytics";

function tag(attrs: Record<string, string>): AnalyticsTag & { attrs: Record<string, string> } {
  return {
    attrs,
    getAttribute: (n) => attrs[n] ?? null,
    setAttribute: (n, v) => {
      attrs[n] = v;
    },
    removeAttribute: (n) => {
      delete attrs[n];
    },
  };
}

describe("analytics", () => {
  beforeEach(() => resetAnalyticsKey());

  it("is off for Kids profiles and on pages whose links carry codes", () => {
    expect(analyticsAllowed("/browse", false)).toBe(true);
    expect(analyticsAllowed("/books/frankenstein", false)).toBe(true);
    expect(analyticsAllowed("/browse", true)).toBe(false);
    for (const p of ["/signin", "/signup", "/reset-password", "/unsubscribe", "/clubs/join/AB12CD", "/lists/x1", "/support", "/dashboard", "/maintenance", "/affiliates/review"]) {
      expect(analyticsAllowed(p, false)).toBe(false);
    }
    expect(analyticsAllowed("/clubs/123", false)).toBe(true);
    // The affiliate program's public page is counted; its staff review page isn't.
    expect(analyticsAllowed("/affiliates", false)).toBe(true);
    expect(analyticsAllowed("/signinx", false)).toBe(true);
  });

  it("gives Ahrefs the path only", () => {
    expect(pageLocation("/search")).toBe("/search");
    expect(pageLocation("library")).toBe("/library");
  });

  it("takes the key off to pause it, and puts it back", () => {
    const t = tag({ "data-key": "abc" });
    expect(applyAnalytics([t], "/browse", true)).toBe(false);
    expect(t.attrs["data-key"]).toBeUndefined();
    expect(t.attrs["data-page-location"]).toBe("/browse");
    expect(applyAnalytics([t], "/search", false)).toBe(true);
    expect(t.attrs["data-key"]).toBe("abc");
    expect(t.attrs["data-page-location"]).toBe("/search");
    // A tag Termly put back after consent is paused too.
    const fresh = tag({ "data-key": "abc" });
    expect(applyAnalytics([fresh], "/unsubscribe", false)).toBe(false);
    expect(fresh.attrs["data-key"]).toBeUndefined();
  });

  it("sends nothing when there's no tag", () => {
    expect(applyAnalytics([], "/browse", false)).toBe(false);
  });
});
