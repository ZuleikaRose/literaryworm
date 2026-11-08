import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getBook } from "../data/books";
import type { Book } from "../types";
import { ALIGNED_BOOKS, alignedTranscript, type Anchor, isAligned, parseAlignment, wordsBefore, wordTime } from "./alignment";

describe("isAligned", () => {
  it("names the fifteen books with an alignment file", () => {
    for (const id of [
      "frankenstein",
      "pride-and-prejudice",
      "alice-in-wonderland",
      "through-the-looking-glass",
      "a-christmas-carol",
      "the-wonderful-wizard-of-oz",
      "dr-jekyll-and-mr-hyde",
      "the-call-of-the-wild",
      "treasure-island",
      "peter-pan",
      "the-war-of-the-worlds",
      "the-jungle-book",
      "heart-of-darkness",
      "the-picture-of-dorian-gray",
      "the-secret-garden",
    ]) {
      expect(isAligned(id)).toBe(true);
    }
    // The Time Machine was aligned too, but most of its chapters barely matched, so it isn't listed.
    expect(isAligned("the-time-machine")).toBe(false);
    expect(isAligned("dracula")).toBe(false);
  });

  it("has a well-formed file for every listed book, one chapter per recording track", () => {
    for (const id of ALIGNED_BOOKS) {
      const file: unknown = JSON.parse(readFileSync(join(process.cwd(), "public", "alignments", `${id}.json`), "utf8"));
      const tracks = getBook(id)?.recording?.tracks.length ?? 0;
      expect(tracks).toBeGreaterThan(0);
      // parseAlignment() refuses a file whose chapters don't match the recording's tracks.
      expect(parseAlignment(file, tracks)).not.toBeNull();
    }
    // And a damaged or mismatched file is refused, so the transcript falls back to the sample.
    expect(parseAlignment(null, 3)).toBeNull();
    expect(parseAlignment({ chapters: [] }, 3)).toBeNull();
  });
});

describe("parseAlignment", () => {
  it("reads a file with one list per chapter", () => {
    expect(parseAlignment({ chapters: [[[0, 1.5], [10, 4]], []] }, 2)).toEqual({ chapters: [[[0, 1.5], [10, 4]], []] });
  });

  it("refuses the wrong shape or chapter count", () => {
    expect(parseAlignment(null, 1)).toBeNull();
    expect(parseAlignment({ chapters: [] }, 1)).toBeNull();
    expect(parseAlignment({ chapters: [[[0, "1"]]] }, 1)).toBeNull();
    expect(parseAlignment({ chapters: [[[-1, 1]]] }, 1)).toBeNull();
    expect(parseAlignment({ chapters: [[[1.5, 1]]] }, 1)).toBeNull();
  });

  it("drops anchors that go back in words or time", () => {
    expect(parseAlignment({ chapters: [[[0, 1], [5, 3], [4, 4], [8, 2.5], [9, 6]]] }, 1)?.chapters[0]).toEqual([
      [0, 1],
      [5, 3],
      [9, 6],
    ]);
  });
});

describe("wordTime", () => {
  const anchors: Anchor[] = [
    [2, 10],
    [12, 20],
    [22, 40],
  ];

  it("is the anchor's time at an anchor", () => {
    expect(wordTime(anchors, 12)).toBe(20);
  });

  it("is in proportion between anchors", () => {
    expect(wordTime(anchors, 7)).toBe(15);
    expect(wordTime(anchors, 17)).toBe(30);
  });

  it("holds at the first and last anchors beyond them", () => {
    expect(wordTime(anchors, 0)).toBe(10);
    expect(wordTime(anchors, 99)).toBe(40);
    expect(wordTime([], 5)).toBe(0);
  });
});

describe("wordsBefore", () => {
  it("counts whole words before an offset", () => {
    const text = "It was a dark night. The wind blew.";
    expect(wordsBefore(text, 0)).toBe(0);
    expect(wordsBefore(text, text.indexOf("The"))).toBe(5);
  });
});

describe("alignedTranscript", () => {
  const book = { id: "x", chapters: [{ minutes: 1 }, { minutes: 2 }] } as unknown as Book;
  const text = "First sentence here. Second one follows now.\n\nA new paragraph starts.";

  it("starts each sentence when its first word is read, from the chapter's start", () => {
    // Words: First(0) sentence(1) here.(2) Second(3) one(4) follows(5) now.(6) A(7) new(8) paragraph(9) starts.(10)
    const lines = alignedTranscript(book, 1, text, [
      [0, 2],
      [3, 8],
      [7, 20],
      [10, 26],
    ])!;
    expect(lines.map((l) => l.text)).toEqual(["First sentence here.", "Second one follows now.", "A new paragraph starts."]);
    expect(lines.map((l) => l.start)).toEqual([62, 68, 80]);
    expect(lines.map((l) => l.end)).toEqual([68, 80, 180]);
    expect(lines.map((l) => l.opensParagraph)).toEqual([true, false, true]);
  });

  it("is null without enough anchors, so the caller falls back", () => {
    expect(alignedTranscript(book, 0, text, [])).toBeNull();
    expect(alignedTranscript(book, 0, text, [[0, 1]])).toBeNull();
  });
});
