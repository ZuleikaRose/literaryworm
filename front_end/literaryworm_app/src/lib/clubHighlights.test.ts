import { describe, expect, it } from "@jest/globals";
import type { Highlight } from "../types";
import { type ClubHighlight, shareable, shareLabel, splitShared } from "./clubHighlights";

const shared = (id: string, chapterIndex: number, createdAt: number, highlightId = `h-${id}`): ClubHighlight => ({
  id,
  userId: "someone",
  author: "Jordan",
  highlightId,
  chapterIndex,
  quote: `Quote ${id}`,
  color: "yellow",
  note: null,
  createdAt,
});

const mine = (id: string, bookId: string, chapterIndex: number, start = 0): Highlight => ({
  id,
  bookId,
  chapterIndex,
  page: 0,
  start,
  end: start + 5,
  quote: `Mine ${id}`,
  color: "blue",
  note: null,
  createdAt: 0,
});

describe("splitShared", () => {
  it("shows chapters up to the reader's in book order and holds back the rest", () => {
    const { visible, hidden } = splitShared([shared("late", 9, 1), shared("b", 2, 5), shared("a", 2, 3), shared("first", 0, 9)], 2);
    expect(visible.map((h) => h.id)).toEqual(["first", "a", "b"]);
    expect(hidden.map((h) => h.id)).toEqual(["late"]);
  });

  it("counts the reader's own chapter as reached, the boundary", () => {
    expect(splitShared([shared("x", 4, 1)], 4).visible).toHaveLength(1);
    expect(splitShared([shared("x", 5, 1)], 4).hidden).toHaveLength(1);
  });

  it("is empty both ways with nothing shared", () => {
    expect(splitShared([], 10)).toEqual({ visible: [], hidden: [] });
  });
});

describe("shareable", () => {
  it("offers only this book's highlights not shared yet, in book order", () => {
    const list = shareable([mine("c", "frankenstein", 3), mine("x", "dracula", 0), mine("a", "frankenstein", 1, 50), mine("b", "frankenstein", 1, 10)], [shared("s", 3, 1, "c")], "frankenstein");
    expect(list.map((h) => h.id)).toEqual(["b", "a"]);
  });

  it("is empty with no highlights", () => {
    expect(shareable([], [], "frankenstein")).toEqual([]);
  });
});

describe("shareLabel", () => {
  it("names the chapter and shortens a long passage at a word's end with an ellipsis", () => {
    const label = shareLabel({ chapterIndex: 0, quote: "It is a truth   universally acknowledged, that a single man in possession of a good fortune" }, "Chapter 1", 30);
    expect(label.startsWith("Chapter 1: “It is a truth universally")).toBe(true);
    expect(label.endsWith("…”")).toBe(true);
  });

  it("falls back to the chapter number when there's no title", () => {
    expect(shareLabel({ chapterIndex: 4, quote: "Short." }, undefined)).toBe("Chapter 5: “Short.”");
  });
});
