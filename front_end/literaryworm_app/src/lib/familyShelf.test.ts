import { describe, expect, it } from "@jest/globals";
import type { AgeRating, BookRequest } from "../types";
import { canFillShelf, type FamilyShelfItem, shelfFor } from "./familyShelf";

const catalog: Record<string, { id: string; ageRating: AgeRating }> = {
  garden: { id: "garden", ageRating: "kids" },
  dune: { id: "dune", ageRating: "teen" },
  grown: { id: "grown", ageRating: "all" },
};
const lookup = (id: string) => catalog[id];
const items: FamilyShelfItem[] = [
  { bookId: "garden", addedBy: "p1", addedAt: 1 },
  { bookId: "dune", addedBy: "p1", addedAt: 3 },
  { bookId: "grown", addedBy: null, addedAt: 2 },
  { bookId: "gone-from-catalog", addedBy: "p1", addedAt: 4 },
];

describe("the family shelf", () => {
  it("shows a grown-up everything still in the catalog, newest first", () => {
    expect(shelfFor(items, { ageRating: "all" }, [], lookup).map((b) => b.id)).toEqual(["dune", "grown", "garden"]);
  });

  it("shows a Kids profile only what it may already open", () => {
    expect(shelfFor(items, { ageRating: "kids" }, [], lookup).map((b) => b.id)).toEqual(["garden"]);
    const yes: BookRequest[] = [{ bookId: "dune", status: "approved", createdAt: 1, answeredAt: 2 }];
    expect(shelfFor(items, { ageRating: "kids" }, yes, lookup).map((b) => b.id)).toEqual(["dune", "garden"]);
    const no: BookRequest[] = [{ bookId: "dune", status: "declined", createdAt: 1, answeredAt: 2 }];
    expect(shelfFor(items, { ageRating: "kids" }, no, lookup).map((b) => b.id)).toEqual(["garden"]);
  });

  it("is filled by grown-up and teen profiles, not Kids", () => {
    expect(canFillShelf({ ageRating: "all" })).toBe(true);
    expect(canFillShelf({ ageRating: "teen" })).toBe(true);
    expect(canFillShelf({ ageRating: "kids" })).toBe(false);
  });
});
