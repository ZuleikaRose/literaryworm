import { CHAPTERS_MAX, EpubError, languageIn, type ParsedBook, WORDS_MAX, countWords, yearIn } from "./epub";
import { tr } from "./i18n";
import { pageParagraphs, type PdfMark, pdfChapters, runningLines } from "./pdfText";

/**
 * Reads a PDF in the browser with pdf.js (pdfjs-dist, Apache-2.0, loaded only when a PDF is
 * chosen) and keeps only its text, rebuilt into paragraphs and parts by lib/pdfText.ts. Nothing
 * is uploaded from here. Scanned PDFs (pictures of pages) have no text to keep.
 */

type TextItem = { str: string; hasEOL?: boolean };

/** The lines on a page: pdf.js gives runs of text, with hasEOL where a line ends. */
function linesOf(items: TextItem[]): string[] {
  const lines: string[] = [];
  let line = "";
  for (const item of items) {
    line += item.str;
    if (item.hasEOL) {
      lines.push(line);
      line = "";
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function readPdf(file: File): Promise<ParsedBook> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  // Errors only: pdf.js warns about fonts it doesn't need for reading text.
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), verbosity: pdfjs.VerbosityLevel.ERRORS });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if ((err as { name?: string }).name === "PasswordException") {
      throw new EpubError(tr("This PDF is locked with a password, so LiteraryWorm can't read it."));
    }
    throw err;
  }
  try {
    const raw: string[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      raw.push(linesOf(content.items as TextItem[]));
      page.cleanup();
    }
    const skip = runningLines(raw);
    const pages = raw.map((lines) => pageParagraphs(lines, skip));
    if (!pages.some((p) => p.length)) {
      throw new EpubError(tr("We couldn't find any text in this PDF. It may be scanned pages, which LiteraryWorm can't read."));
    }

    // The PDF's bookmarks, top level only, as pages.
    const marks: PdfMark[] = [];
    for (const item of (await doc.getOutline()) ?? []) {
      try {
        const dest = typeof item.dest === "string" ? await doc.getDestination(item.dest) : item.dest;
        const ref = dest?.[0];
        if (ref && typeof ref === "object") marks.push({ title: item.title, page: await doc.getPageIndex(ref) });
        else if (typeof ref === "number") marks.push({ title: item.title, page: ref });
      } catch {
        // A bookmark pointing nowhere is left out.
      }
    }
    const chapters = pdfChapters(pages, marks, (from, to) => (from === to ? `Page ${from}` : `Pages ${from}–${to}`));
    if (chapters.length > CHAPTERS_MAX) throw new EpubError(tr("This book has more than {max} parts, more than LiteraryWorm can show.", { max: CHAPTERS_MAX }));
    if (chapters.reduce((n, c) => n + countWords(c.text), 0) > WORDS_MAX) {
      throw new EpubError(tr("This book is too long for LiteraryWorm (over 5 million words)."));
    }

    const { info } = (await doc.getMetadata()) as { info: Record<string, unknown> };
    const text = (key: string) => (typeof info?.[key] === "string" ? (info[key] as string).replace(/\s+/g, " ").trim() : "");
    return {
      title: (text("Title") || file.name.replace(/\.pdf$/i, "")).slice(0, 200),
      author: text("Author").slice(0, 200),
      // PDF dates look like D:20190412…: the year is the first four digits.
      year: yearIn(text("CreationDate").replace(/^D:/, "").slice(0, 4)),
      language: languageIn(text("Language") || text("Lang")),
      chapters,
    };
  } finally {
    void task.destroy();
  }
}
