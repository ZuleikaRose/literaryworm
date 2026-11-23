import { describe, expect, it } from "@jest/globals";
import { functionErrorMessage } from "./functionErrors";

const WORDS = { wrongPassword: "That isn't the account password.", staffOnly: "Only billing staff can retry referral credits.", stillOwed: "Still owed.", tooMany: "Too many tries." };
const FALLBACK = "We couldn't do that.";
const FORBIDDEN_STATUS = 403;
const RATE_LIMITED_STATUS = 429;
const SERVER_ERROR_STATUS = 500;

describe("what an Edge Function refusal says", () => {
  it("a missing staff role says so, never that the password is wrong", () => {
    expect(functionErrorMessage(FORBIDDEN_STATUS, { error: { code: "staff_only", message: "x" } }, FALLBACK, WORDS)).toBe(WORDS.staffOnly);
  });

  it("a refused password keeps its own words", () => {
    expect(functionErrorMessage(FORBIDDEN_STATUS, { error: { code: "forbidden" } }, FALLBACK, WORDS)).toBe(WORDS.wrongPassword);
  });

  it("too many tries", () => {
    expect(functionErrorMessage(RATE_LIMITED_STATUS, { error: { code: "rate_limited" } }, FALLBACK, WORDS)).toBe(WORDS.tooMany);
  });

  it("other refusals use the function's message, or the fallback when there's none", () => {
    expect(functionErrorMessage(SERVER_ERROR_STATUS, { error: { code: "upstream_error", message: "Stripe didn't answer." } }, FALLBACK, WORDS)).toBe("Stripe didn't answer.");
    expect(functionErrorMessage(SERVER_ERROR_STATUS, null, FALLBACK, WORDS)).toBe(FALLBACK);
    expect(functionErrorMessage(SERVER_ERROR_STATUS, {}, FALLBACK, WORDS)).toBe(FALLBACK);
  });

  it("an event whose referral still owes something can't be dismissed, and says what to do", () => {
    expect(functionErrorMessage(409, { error: { code: "still_owed", message: "x" } }, FALLBACK, WORDS)).toBe(WORDS.stillOwed);
  });
});
