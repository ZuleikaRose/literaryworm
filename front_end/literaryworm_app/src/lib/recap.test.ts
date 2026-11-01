import { describe, expect, it } from "@jest/globals";
import { canRecap } from "./recap";

describe("canRecap", () => {
  it("is for public-domain titles past the first chapter", () => {
    expect(canRecap({ recording: { id: 1 } }, 1)).toBe(true);
    expect(canRecap({ recording: { id: 1 } }, 0)).toBe(false);
    expect(canRecap({}, 3)).toBe(false);
  });
});
