import { describe, expect, it } from "@jest/globals";
import { BOOK_FILE_ACCEPT, bookFileKind } from "./bookFile";

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
});
