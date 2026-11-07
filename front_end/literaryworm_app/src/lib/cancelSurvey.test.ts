import { describe, expect, it } from "@jest/globals";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CANCEL_COMMENT_MAX, CANCEL_REASONS, cancelAnswerError, planBelow, SAVE_OFFERS, saveOfferFor } from "./cancelSurvey";

const repo = join(__dirname, "../../../..");
const quoted = (list: readonly string[]) => list.map((x) => `"${x}"`);

describe("why a member cancels", () => {
  const monthly = { planId: "standard" as const, interval: "month" as const, creditAvailable: true };

  it("offers a smaller plan for the price, and the credit on Basic only while it's unused", () => {
    expect(saveOfferFor("too_expensive", monthly)).toBe("downgrade");
    expect(saveOfferFor("too_expensive", { ...monthly, planId: "basic" })).toBe("credit");
    expect(saveOfferFor("too_expensive", { ...monthly, planId: "basic", creditAvailable: false })).toBeNull();
  });

  it("offers a pause on monthly billing only, since a year is already paid for", () => {
    expect(saveOfferFor("not_enough_time", monthly)).toBe("pause");
    expect(saveOfferFor("taking_a_break", monthly)).toBe("pause");
    expect(saveOfferFor("taking_a_break", { ...monthly, interval: "year" })).toBe("credit");
    expect(saveOfferFor("taking_a_break", { ...monthly, interval: "year", creditAvailable: false })).toBeNull();
  });

  it("points to uploads for missing books and to Help for problems, and offers nothing without a reason", () => {
    expect(saveOfferFor("missing_books", monthly)).toBe("upload");
    expect(saveOfferFor("technical_problems", { ...monthly, creditAvailable: false })).toBe("help");
    expect(saveOfferFor("found_another", monthly)).toBe("credit");
    expect(saveOfferFor("other", { ...monthly, creditAvailable: false })).toBeNull();
    expect(saveOfferFor(null, monthly)).toBeNull();
  });

  it("steps down one plan at a time", () => {
    expect([planBelow("premium"), planBelow("standard"), planBelow("basic")]).toEqual(["standard", "basic", null]);
  });

  it("needs a reason for a note, and keeps the note short", () => {
    expect(cancelAnswerError(null, "")).toBeNull();
    expect(cancelAnswerError(null, "  ")).toBeNull();
    expect(cancelAnswerError(null, "hello")).toMatch(/Choose a reason/);
    expect(cancelAnswerError("other", "x".repeat(CANCEL_COMMENT_MAX))).toBeNull();
    expect(cancelAnswerError("other", "x".repeat(CANCEL_COMMENT_MAX + 1))).toMatch(/characters/);
  });

  it("keeps the reasons and offers the same as the server and the database", () => {
    const shared = readFileSync(join(repo, "supabase/functions/_shared/cancelReasons.ts"), "utf8");
    for (const x of [...quoted(CANCEL_REASONS), ...quoted(SAVE_OFFERS)]) expect(shared).toContain(x);
    expect(shared).toContain(`CANCEL_COMMENT_MAX = ${CANCEL_COMMENT_MAX}`);
    const dir = join(repo, "supabase/migrations");
    const migration = readdirSync(dir).find((f) => f.endsWith("_cancellation_feedback.sql"));
    const sql = readFileSync(join(dir, migration!), "utf8");
    for (const x of [...CANCEL_REASONS, ...SAVE_OFFERS]) expect(sql).toContain(`'${x}'`);
    expect(sql).toContain(`<= ${CANCEL_COMMENT_MAX}`);
  });
});
