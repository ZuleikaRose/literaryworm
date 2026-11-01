import { describe, expect, it } from "@jest/globals";
import type { LibraryEntry, Progress } from "../types";
import { smartLists } from "./smartLists";

const DAY = 86_400_000;
const now = 100 * DAY;
const entry = (bookId: string, o: Partial<LibraryEntry> = {}): LibraryEntry => ({ bookId, status: "reading", addedAt: now - 60 * DAY, ...o });
const prog = (bookId: string, fraction: number, daysAgo: number, finished = false): Progress => ({ bookId, format: "ebook", fraction, chapterIndex: 1, updatedAt: now - daysAgo * DAY, finished });

const lists = smartLists({
  entries: [
    entry("a"),
    entry("b"),
    entry("c"),
    entry("d", { status: "finished" }),
    entry("e", { status: "want_to_read", authors: ["Ursula K. Le Guin"] }),
  ],
  progress: { a: prog("a", 0.8, 2), b: prog("b", 0.55, 45), c: prog("c", 0.1, 90) },
  ratings: { d: "love", a: "like" },
  follows: [{ kind: "author", name: "ursula k. le guin" }, { kind: "narrator", name: "Jim Dale" }],
  authorsOf: (e) => e.authors ?? (e.bookId === "a" ? ["Jim Dale"] : []),
  now,
});
const get = (id: string) => lists.find((l) => l.id === id)!.bookIds;

describe("smartLists", () => {
  it("Almost there: books being read past halfway, furthest first", () => {
    expect(get("almost-there")).toEqual(["a", "b"]);
  });

  it("Waiting for you: started books not opened for 30 days, longest first", () => {
    expect(get("waiting")).toEqual(["c", "b"]);
  });

  it("From authors you follow: by name, ignoring case; narrators don't count", () => {
    expect(get("followed")).toEqual(["e"]);
  });

  it("Loved it: rated Love it", () => {
    expect(get("loved")).toEqual(["d"]);
  });
});
