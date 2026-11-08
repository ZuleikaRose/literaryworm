import { EpubError, type ParsedBook, readEpub } from "./epub";
import { tk, tr } from "./i18n";

/**
 * The books Uploads takes: EPUB (lib/epub.ts), PDF (lib/pdf.ts, with pdf.js) and DRM-free Kindle
 * books (lib/mobi.ts: .mobi, .azw3, .azw). Each is read in the browser into the same ParsedBook,
 * text only; the PDF and Kindle readers load only when such a file is chosen.
 */
export type BookFileKind = "epub" | "pdf" | "kindle";

/**
 * Every file Uploads takes, for the list shown wherever a book can be uploaded
 * (components/UploadFormats.tsx), the FAQ and Help: each format's name, its file endings, and a
 * note. Keep it in step with BOOK_FILE_ACCEPT and bookFileKind() (bookFile.test.ts checks).
 */
export const UPLOAD_FORMATS: readonly { kind: BookFileKind; name: string; extensions: readonly string[]; note: string }[] = [
  { kind: "epub", name: "EPUB", extensions: [".epub"], note: tk("The usual ebook format, sold without DRM by many shops and publishers.") },
  { kind: "pdf", name: "PDF", extensions: [".pdf"], note: tk("PDFs with real text. Password-locked and scanned (picture-only) PDFs can't be read.") },
  {
    kind: "kindle",
    name: "Kindle (MOBI, AZW3, AZW)",
    extensions: [".mobi", ".azw3", ".azw"],
    note: tk("Kindle books without DRM. Some older Kindle files need converting to EPUB first, with a free app such as Calibre."),
  },
];

/** What the file picker offers. */
export const BOOK_FILE_ACCEPT = ".epub,application/epub+zip,.pdf,application/pdf,.mobi,.azw3,.azw,application/x-mobipocket-ebook";

/** The kind of book a file is, by its name, or null when Uploads can't take it. */
export function bookFileKind(name: string): BookFileKind | null {
  if (/\.epub$/i.test(name)) return "epub";
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.(mobi|azw3|azw)$/i.test(name)) return "kindle";
  return null;
}

export async function readBookFile(file: File): Promise<ParsedBook> {
  const kind = bookFileKind(file.name);
  if (kind === "epub") return readEpub(file);
  try {
    if (kind === "pdf") return await (await import("./pdf")).readPdf(file);
    if (kind === "kindle") return await (await import("./mobi")).readKindle(file);
  } catch (err) {
    if (err instanceof EpubError) throw err;
    console.error(`${kind}: couldn't read the file:`, err);
    throw new EpubError(
      kind === "pdf"
        ? tr("This PDF is damaged or in a form LiteraryWorm can't read. Try another copy.")
        : tr("This Kindle book is damaged or in a form LiteraryWorm can't read. Try another copy, or convert it to EPUB."),
    );
  }
  throw new EpubError(tr("LiteraryWorm takes EPUB, PDF and Kindle (MOBI, AZW3) books."));
}
