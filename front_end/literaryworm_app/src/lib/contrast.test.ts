import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { contrastRatio, prefersMoreContrast } from "./contrast";

/** The custom properties set in one rule of tokens.css, e.g. ':root[data-high-contrast] {'. */
function tokens(selector: string): Record<string, string> {
  const css = readFileSync("src/styles/tokens.css", "utf8");
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
}

const TEXT = ["ink", "ink-soft", "muted", "faint", "rust-bright", "rust-ink", "star", "danger", "success"];

describe("high contrast", () => {
  for (const [name, selector] of [
    ["dark", ":root[data-high-contrast]"],
    ["light", ':root[data-theme="light"][data-high-contrast]'],
  ] as const) {
    const t = tokens(selector);
    it(`keeps every text colour at 7:1 or more on the ${name} surfaces (WCAG AAA)`, () => {
      for (const surface of ["bg", "surface", "surface-raised", "field"]) {
        for (const text of TEXT) expect([text, surface, contrastRatio(t[text], t[surface]) >= 7]).toEqual([text, surface, true]);
      }
      expect(contrastRatio(t["on-accent"], t.rust)).toBeGreaterThanOrEqual(7);
    });
    it(`keeps edges at 3:1 or more on the ${name} surfaces`, () => {
      for (const surface of ["bg", "surface", "surface-raised"]) {
        expect(contrastRatio(t.line, t[surface])).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(t["line-strong"], t[surface])).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("measures contrast as WCAG does", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
  });

  it("follows the device's contrast setting where there is one", () => {
    expect(prefersMoreContrast()).toBe(false);
    const g = globalThis as { window?: unknown };
    g.window = { matchMedia: (q: string) => ({ matches: q === "(prefers-contrast: more)" }) };
    expect(prefersMoreContrast()).toBe(true);
    delete g.window;
  });
});
