import { describe, expect, it } from "@jest/globals";
import { hasPasswordMix, passwordMix, PASSWORD_SYMBOLS, validateNewPassword } from "./validation";

describe("new passwords follow Supabase Auth's rules", () => {
  it("needs a lowercase letter, a capital, a number and a symbol", () => {
    expect(passwordMix("abc")).toEqual({ lower: true, upper: false, number: false, symbol: false });
    expect(hasPasswordMix("Reading by the sea 4 ever!")).toBe(true);
    expect(hasPasswordMix("reading by the sea 4 ever!")).toBe(false);
    expect(hasPasswordMix("READING BY THE SEA 4 EVER!")).toBe(false);
    expect(hasPasswordMix("Reading by the sea for ever!")).toBe(false);
    expect(hasPasswordMix("Reading by the sea 4 ever")).toBe(false);
  });

  it("counts only the symbols Auth counts", () => {
    // A space, £ or an accented letter isn't one of them.
    expect(hasPasswordMix("Reading by the sea 4 ever £")).toBe(false);
    expect(hasPasswordMix("Réading by the sea 4 ever")).toBe(false);
    for (const symbol of PASSWORD_SYMBOLS) expect(hasPasswordMix(`Reading by the sea 4 ever${symbol}`)).toBe(true);
    expect(PASSWORD_SYMBOLS).toContain("\\");
    expect(PASSWORD_SYMBOLS).toContain(":");
  });

  it("checks length first, then the mix, then the breach list", () => {
    expect(validateNewPassword("")).toMatch(/Choose a password/);
    expect(validateNewPassword("Short 1!")).toMatch(/at least 15/);
    expect(validateNewPassword(`A1!${"a".repeat(62)}`)).toMatch(/64 characters or fewer/);
    expect(validateNewPassword("a long phrase without the rest")).toMatch(/lowercase letter, one capital/);
    expect(validateNewPassword("Reading by the sea 4 ever!")).toBeNull();
  });
});
