import { describe, expect, it } from "@jest/globals";
import { EPUB_MAX_BYTES } from "./epub";
import { batchSummary, planBatch, UPLOADS_AT_ONCE } from "./uploadBatch";

const epub = (n: number, size = 1000) => ({ name: `book-${n}.epub`, size });

describe("adding several books at once", () => {
  it("takes up to 20 EPUBs and counts the rest", () => {
    const plan = planBatch(Array.from({ length: 23 }, (_, i) => epub(i)));
    expect(UPLOADS_AT_ONCE).toBe(20);
    expect(plan.take).toHaveLength(20);
    expect(plan.take[19].name).toBe("book-19.epub");
    expect(plan.overLimit).toBe(3);
    expect(plan.skipped).toEqual([]);
  });

  it("keeps the 50 MB limit for each file, takes PDF and Kindle books, and skips other files", () => {
    const plan = planBatch([
      epub(1),
      { name: "big.epub", size: EPUB_MAX_BYTES + 1 },
      { name: "notes.pdf", size: 10 },
      { name: "story.MOBI", size: 10 },
      { name: "novel.azw3", size: 10 },
      { name: "photo.jpg", size: 10 },
      { name: "SHOUT.EPUB", size: EPUB_MAX_BYTES },
    ]);
    expect(plan.take.map((f) => f.name)).toEqual(["book-1.epub", "notes.pdf", "story.MOBI", "novel.azw3", "SHOUT.EPUB"]);
    expect(plan.skipped).toEqual([
      { name: "big.epub", reason: "is over 50 MB" },
      { name: "photo.jpg", reason: "isn't an EPUB, PDF or Kindle book" },
    ]);
  });

  it("doesn't count skipped files towards the 20", () => {
    const plan = planBatch([{ name: "a.txt", size: 1 }, ...Array.from({ length: 20 }, (_, i) => epub(i))]);
    expect(plan.take).toHaveLength(20);
    expect(plan.overLimit).toBe(0);
  });
});

describe("what a batch says when it's done", () => {
  it("names one book, counts several", () => {
    expect(batchSummary(["Emma"], [], 0)).toEqual({ done: "Emma is ready to read.", problem: null });
    expect(batchSummary(["Emma", "Persuasion"], [], 0).done).toBe("2 books are ready to read.");
  });

  it("lists what wasn't added and why, and the files over 20", () => {
    const { done, problem } = batchSummary([], [{ name: "big.epub", reason: "is over 50 MB" }], 2);
    expect(done).toBeNull();
    expect(problem).toBe("Not added: big.epub is over 50 MB; 2 more were left out: add up to 20 at a time.");
  });
});
