import { describe, expect, it } from "@jest/globals";
import { books } from "../data/books";
import type { BookRequest, Profile, ProfileData } from "../types";
import { answerable, approved, approvedBooks, canAsk, mayOpen, requestAlerts, requestFor, waitingRequests } from "./bookRequests";

const forAll = books.find((b) => b.ageRating === "all")!;
const forTeens = books.find((b) => b.ageRating === "teen")!;
const forKids = books.find((b) => b.ageRating === "kids")!;

const request = (bookId: string, status: BookRequest["status"], createdAt: number, answeredAt: number | null = null): BookRequest => ({
  bookId,
  status,
  createdAt,
  answeredAt: status === "pending" ? null : (answeredAt ?? createdAt + 1),
});

const profile = (id: string, ageRating: Profile["ageRating"]): Profile =>
  ({ id, name: id, avatar: 0, ageRating, favoriteGenres: [] }) as unknown as Profile;

describe("mayOpen", () => {
  const kid = profile("kid", "kids");
  it("opens books rated for the profile", () => {
    expect(mayOpen(forKids, kid, [])).toBe(true);
    expect(mayOpen(forAll, profile("adult", "all"), [])).toBe(true);
  });
  it("keeps other books shut until a grown-up says yes", () => {
    expect(mayOpen(forAll, kid, [])).toBe(false);
    expect(mayOpen(forAll, kid, [request(forAll.id, "pending", 1)])).toBe(false);
    expect(mayOpen(forAll, kid, [request(forAll.id, "declined", 1)])).toBe(false);
    expect(mayOpen(forAll, kid, [request(forAll.id, "approved", 1)])).toBe(true);
  });
  it("is for Kids profiles only", () => {
    expect(mayOpen(forAll, profile("teen", "teen"), [request(forAll.id, "approved", 1)])).toBe(false);
  });
});

describe("canAsk", () => {
  it("lets Kids profiles ask for catalog books above their rating", () => {
    expect(canAsk(forTeens, profile("kid", "kids"))).toBe(true);
    expect(canAsk(forKids, profile("kid", "kids"))).toBe(false);
    expect(canAsk(undefined, profile("kid", "kids"))).toBe(false);
    expect(canAsk(forAll, profile("teen", "teen"))).toBe(false);
  });
});

const withRequests = (bookRequests: BookRequest[]) => ({ bookRequests }) as unknown as ProfileData;

describe("requests for the grown-ups", () => {
  const kid = profile("kid", "kids");
  const other = profile("other", "kids");
  const adult = profile("adult", "all");
  const data = {
    kid: withRequests([request(forAll.id, "pending", 30), request(forTeens.id, "approved", 10, 40)]),
    other: withRequests([request(forTeens.id, "pending", 20), request("not-in-catalog", "pending", 5)]),
    adult: withRequests([request(forAll.id, "pending", 1)]),
  };

  it("lists waiting requests oldest first, Kids profiles and catalog books only", () => {
    const waiting = waitingRequests([kid, other, adult], data);
    expect(waiting.map((w) => [w.profile.id, w.book.id])).toEqual([
      ["other", forTeens.id],
      ["kid", forAll.id],
    ]);
    expect(requestAlerts(waiting).map((a) => a.at)).toEqual([20, 30]);
  });

  it("puts answered requests after the waiting ones", () => {
    expect(answerable([kid, other], data).map((w) => w.request.status)).toEqual(["pending", "pending", "approved"]);
  });
});

describe("a profile's own requests", () => {
  const mine = [request(forAll.id, "approved", 1, 5), request(forTeens.id, "approved", 2, 9), request(forKids.id, "declined", 3)];
  it("finds a request and its answer", () => {
    expect(requestFor(mine, forKids.id)?.status).toBe("declined");
    expect(approved(mine, forAll.id)).toBe(true);
    expect(approved(mine, forKids.id)).toBe(false);
  });
  it("lists the books a grown-up said yes to, newest answer first", () => {
    expect(approvedBooks(mine).map((b) => b.id)).toEqual([forTeens.id, forAll.id]);
  });
});
