import { describe, expect, it } from "@jest/globals";
import { DEMO_UPLOAD_READING, DEMO_UPLOAD_TEXTS, demoUploads } from "../data/demoUploads";
import { countWords } from "./epub";
import { seriesInTitle, sortUploads } from "./librarySort";
import { isUploadId } from "./uploadBook";
import { recordingFor } from "./uploadRecording";

describe("the demo's sample uploads", () => {
  const now = Date.UTC(2026, 10, 2);
  const uploads = demoUploads(now);

  it("are valid uploads whose details match their text", () => {
    expect(uploads).toHaveLength(4);
    for (const u of uploads) {
      expect(isUploadId(u.id)).toBe(true);
      const text = DEMO_UPLOAD_TEXTS.get(u.id)!;
      expect(text).toHaveLength(u.chapterTitles.length);
      expect(u.chapterWords).toEqual(text.map(countWords));
      expect(u.words).toBe(u.chapterWords.reduce((a, b) => a + b, 0));
      expect(u.createdAt).toBeLessThan(now);
      expect(u.publishedYear).toBeGreaterThan(1700);
    }
  });

  it("give every Uploads sort something to show: a series, years and upload days", () => {
    expect(uploads.map((u) => seriesInTitle(u.title)?.name ?? null)).toEqual(["The Lantern Coast", "The Lantern Coast", null, null]);
    expect(sortUploads(uploads, "series").map((u) => u.title)).toEqual([
      "The Tide Clock (The Lantern Coast, #1)",
      "The Salt Archive (The Lantern Coast, #2)",
      "Frankenstein; Or, The Modern Prometheus",
      "Notes from a Small Orchard",
    ]);
    expect(sortUploads(uploads, "published").map((u) => u.publishedYear)).toEqual([2021, 2019, 2008, 1818]);
    expect(new Set(uploads.map((u) => u.createdAt)).size).toBe(4);
  });

  it("have no text for an id that isn't one of them, and no empty chapter", () => {
    expect(DEMO_UPLOAD_TEXTS.get("u-00000000000000000000000000000000")).toBeUndefined();
    expect(DEMO_UPLOAD_TEXTS.get("")).toBeUndefined();
    for (const u of uploads) {
      expect(Math.min(...u.chapterWords)).toBeGreaterThan(0);
      expect(u.chapterTitles.every((t) => t.trim().length > 0)).toBe(true);
    }
  });

  it("name one of themselves as the book being read", () => {
    expect(uploads.some((u) => u.id === DEMO_UPLOAD_READING)).toBe(true);
    expect(DEMO_UPLOAD_TEXTS.has(DEMO_UPLOAD_READING)).toBe(true);
  });

  it("keep the same order whatever day the demo is opened", () => {
    for (const day of [0, now, now + 400 * 86_400_000]) {
      const again = demoUploads(day);
      expect(again.map((u) => u.id)).toEqual(uploads.map((u) => u.id));
      expect(sortUploads(again, "added").map((u) => u.id)).toEqual(sortUploads(uploads, "added").map((u) => u.id));
      expect(again.every((u) => u.createdAt < day)).toBe(true);
    }
  });

  it("include one the catalog has a LibriVox recording of, and only one", () => {
    expect(uploads.map((u) => recordingFor(u, "all")?.id ?? null)).toEqual([null, null, null, "frankenstein"]);
  });
});
