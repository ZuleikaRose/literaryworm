import { describe, expect, it } from "@jest/globals";
import { BOOK_FILE_ACCEPT, bookFileKind, UPLOAD_FORMATS } from "./bookFile";

describe("the books Uploads takes", () => {
  it("knows each kind by its name, whatever the case", () => {
    expect(["a.epub", "B.EPUB", "c.pdf", "d.mobi", "e.azw3", "f.AZW", "g.txt", "h.epub.zip", "", "pdf"].map(bookFileKind)).toEqual([
      "epub",
      "epub",
      "pdf",
      "kindle",
      "kindle",
      "kindle",
      null,
      null,
      null,
      null,
    ]);
  });

  it("offers every kind in the file picker", () => {
    for (const ext of [".epub", ".pdf", ".mobi", ".azw3", ".azw"]) expect(BOOK_FILE_ACCEPT.split(",")).toContain(ext);
  });
  it("lists every file it takes, and only those, for the app's list of formats", () => {
    const listed = UPLOAD_FORMATS.flatMap((f) => f.extensions);
    // Each listed ending is taken as its own kind, and the file picker offers it.
    for (const f of UPLOAD_FORMATS) for (const ext of f.extensions) expect(bookFileKind(`book${ext}`)).toBe(f.kind);
    expect(listed.every((ext) => BOOK_FILE_ACCEPT.split(",").includes(ext))).toBe(true);
    // And every ending the picker offers is listed.
    expect(BOOK_FILE_ACCEPT.split(",").filter((a) => a.startsWith(".")).sort()).toEqual([...listed].sort());
  });
});
