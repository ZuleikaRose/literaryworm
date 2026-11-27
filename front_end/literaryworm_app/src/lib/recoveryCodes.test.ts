import { describe, expect, it } from "@jest/globals";
import { cleanRecoveryCode, looksLikeRecoveryCode, recoveryCodesFileName, recoveryCodesText } from "./recoveryCodes";

describe("recovery codes", () => {
  it("reads a code the way the database does", () => {
    expect(cleanRecoveryCode(" ABCDE-12345 ")).toBe("abcde12345");
    expect(cleanRecoveryCode("abcde 12345")).toBe("abcde12345");
    // Letters Crockford base32 leaves out are read as the digits they look like.
    expect(cleanRecoveryCode("OIL0a-bcdef")).toBe("0110abcdef");
  });

  it("knows what could be a code", () => {
    expect(looksLikeRecoveryCode("7k2mp-q9xzt")).toBe(true);
    expect(looksLikeRecoveryCode("7K2MP Q9XZT")).toBe(true);
    expect(looksLikeRecoveryCode("123456")).toBe(false);
    expect(looksLikeRecoveryCode("7k2mp-q9xzu")).toBe(false); // no u
    expect(looksLikeRecoveryCode("7k2mp-q9xzt1")).toBe(false);
    expect(looksLikeRecoveryCode("")).toBe(false);
  });

  it("lays the codes out to keep, with the day and the account", () => {
    const day = new Date("2026-11-27T10:00:00Z");
    const text = recoveryCodesText(["aaaaa-bbbbb", "ccccc-ddddd"], day, "sam@example.com");
    expect(text).toContain("For sam@example.com, made 2026-11-27.");
    expect(text.split("\n")).toEqual(expect.arrayContaining(["aaaaa-bbbbb", "ccccc-ddddd"]));
    expect(recoveryCodesFileName(day)).toBe("literaryworm-recovery-codes-2026-11-27.txt");
  });
});
