import { describe, expect, it } from "@jest/globals";
import type { JournalEntry } from "../types";
import { entriesFor, JOURNAL_BODY_MAX, journalDay, journalError } from "./journal";

const entry = (id: string, bookId: string, writtenOn: string, createdAt: number): JournalEntry => ({ id, bookId, body: id, writtenOn, createdAt, updatedAt: createdAt });

describe("journalError", () => {
  const today = "2026-10-31";
  it("accepts an entry about today or a day before", () => {
    expect(journalError("Loved the storm chapter.", today, today)).toBeNull();
    expect(journalError("Started it.", "2026-01-02", today)).toBeNull();
  });
  it("refuses empty, too long, future and malformed entries", () => {
    expect(journalError("   ", today, today)).toBe("Write something first.");
    expect(journalError("x".repeat(JOURNAL_BODY_MAX + 1), today, today)).toMatch(/5,000 characters/);
    expect(journalError("Soon", "2026-11-01", today)).toBe("Pick today or a day before.");
    expect(journalError("Hm", "31/10/2026", today)).toBe("Pick the day it's about.");
  });
});

describe("entriesFor", () => {
  it("lists one book's entries, the newest day first", () => {
    const journal = [entry("a", "dune", "2026-10-01", 1), entry("b", "dune", "2026-10-05", 2), entry("c", "emma", "2026-10-09", 3), entry("d", "dune", "2026-10-05", 4)];
    expect(entriesFor(journal, "dune").map((e) => e.id)).toEqual(["d", "b", "a"]);
  });
});

describe("journalDay", () => {
  it("names the day", () => {
    expect(journalDay("2026-10-31")).toBe("Sat, 31 October 2026");
  });
});
