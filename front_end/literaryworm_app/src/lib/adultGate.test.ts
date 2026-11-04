import { afterEach, describe, expect, it } from "@jest/globals";
import { adultGate, confirmVisitorAdult, resetVisitorAdult, visitorIsAdult } from "./adultGate";

const check = { mature: true, ageRating: "all" as const, profileConfirmedAt: null, visitorConfirmed: false };

describe("adultGate", () => {
  it("shows books that aren't marked mature to everyone", () => {
    for (const ageRating of ["all", "teen", "kids", null] as const) {
      expect(adultGate({ ...check, mature: false, ageRating })).toBe("show");
    }
  });

  it("never opens a mature book for Kids or Teen profiles, even if confirmed", () => {
    expect(adultGate({ ...check, ageRating: "teen", profileConfirmedAt: 1 })).toBe("blocked");
    expect(adultGate({ ...check, ageRating: "kids", visitorConfirmed: true })).toBe("blocked");
  });

  it("asks an adult profile once, then remembers", () => {
    expect(adultGate(check)).toBe("gate");
    expect(adultGate({ ...check, profileConfirmedAt: Date.parse("2026-11-04T10:00:00Z") })).toBe("show");
  });

  it("asks a visitor without a profile, for the visit", () => {
    expect(adultGate({ ...check, ageRating: null })).toBe("gate");
    expect(adultGate({ ...check, ageRating: null, visitorConfirmed: true })).toBe("show");
  });

  it("doesn't let a visitor's answer stand in for a profile's", () => {
    expect(adultGate({ ...check, visitorConfirmed: true })).toBe("gate");
  });
});

describe("a visitor's answer", () => {
  afterEach(() => resetVisitorAdult());

  it("lasts for the visit and starts unanswered", () => {
    expect(visitorIsAdult()).toBe(false);
    confirmVisitorAdult();
    expect(visitorIsAdult()).toBe(true);
  });
});
