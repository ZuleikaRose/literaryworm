import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { books } from "../data/books";

/**
 * The functions check a reader's chapter against supabase/functions/_shared/chapterCounts.ts
 * before downloading a book: it must list every public-domain title with text, with the
 * same number of chapters as the app.
 */
const SOURCE = readFileSync(join(__dirname, "../../../../supabase/functions/_shared/chapterCounts.ts"), "utf8");
const listed = Object.fromEntries([...SOURCE.matchAll(/^ {2}"([a-z0-9-]+)": (\d+),$/gm)].map((m) => [m[1], Number(m[2])]));
const withText = books.filter((b) => b.publicDomain && b.recording);

describe("the functions' chapter counts", () => {
  it("list every public-domain title with text, and nothing else", () => {
    expect(Object.keys(listed).sort()).toEqual(withText.map((b) => b.id).sort());
  });

  it("give each the app's number of chapters", () => {
    for (const b of withText) expect({ id: b.id, chapters: listed[b.id] }).toEqual({ id: b.id, chapters: b.chapters.length });
  });

  it("match the texts kept in the repository", () => {
    for (const id of ["pride-and-prejudice", "frankenstein", "alice-in-wonderland"]) {
      const chapters: string[] = JSON.parse(readFileSync(join(__dirname, `../../public/texts/${id}.json`), "utf8")).chapters;
      expect(listed[id]).toBe(chapters.length);
    }
  });
});
