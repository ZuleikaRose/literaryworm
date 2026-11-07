/**
 * Turning a PDF's text into a book (lib/pdf.ts reads the PDF with pdf.js). PDFs keep lines, not
 * paragraphs, so the text is rebuilt here: page numbers and repeated running heads are dropped,
 * words hyphenated across lines are joined, and a paragraph ends where a sentence ends on a short
 * line. Chapters come from the PDF's own bookmarks (its outline) when it has them, else from runs
 * of pages.
 */

/** Pages per part when the PDF has no bookmarks to split it by. */
export const PDF_PAGES_PER_PART = 20;

/** A bookmark: its title and the page (0-based) it points to. */
export interface PdfMark {
  title: string;
  page: number;
}

const SENTENCE_END = /[.!?:;"”’»)\]]$/;
const PAGE_NUMBER = /^(page\s+)?[\divxlc]+(\s*(of|\/)\s*\d+)?$/i;

/** First or last lines that appear on most pages (running heads and feet), compared without digits. */
export function runningLines(pages: string[][]): Set<string> {
  if (pages.length < 4) return new Set();
  const key = (line: string) => line.replace(/\d+/g, "#").trim().toLowerCase();
  const counts = new Map<string, number>();
  for (const page of pages) {
    const edges = new Set([page[0] ?? "", page[page.length - 1] ?? ""].map(key).filter((k) => k.length > 0 && k.length <= 80));
    for (const k of edges) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, n]) => n >= Math.max(3, pages.length * 0.5)).map(([k]) => k));
}

/** One page's lines as paragraphs. `skip` holds running lines (from runningLines()). */
export function pageParagraphs(lines: string[], skip: Set<string> = new Set()): string[] {
  const kept = lines
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l && !PAGE_NUMBER.test(l) && !skip.has(l.replace(/\d+/g, "#").trim().toLowerCase()));
  if (!kept.length) return [];
  const longest = Math.max(...kept.map((l) => l.length));
  const paragraphs: string[] = [];
  let current = "";
  kept.forEach((line, i) => {
    if (!current) current = line;
    else if (/[A-Za-zÀ-ÿ]-$/.test(current) && /^[a-zà-ÿ]/.test(line)) current = current.slice(0, -1) + line;
    else current += " " + line;
    const last = i === kept.length - 1;
    // A paragraph ends where a sentence ends on a line well short of the page's full width.
    if (!last && SENTENCE_END.test(line) && line.length < longest * 0.8) {
      paragraphs.push(current);
      current = "";
    }
  });
  if (current) paragraphs.push(current);
  return paragraphs;
}

/**
 * The book's parts: one per bookmark that starts a new page (in page order), the pages before the
 * first one joining it; without usable bookmarks, runs of PDF_PAGES_PER_PART pages.
 */
export function pdfChapters(pages: string[][], marks: PdfMark[], partTitle: (from: number, to: number) => string): { title: string; text: string }[] {
  const starts = [...new Map(marks.filter((m) => m.page >= 0 && m.page < pages.length && m.title.trim()).map((m) => [m.page, m.title.trim()] as const))]
    .sort((a, b) => a[0] - b[0]);
  const ranges: { title: string; from: number; to: number }[] = [];
  if (starts.length >= 2) {
    starts.forEach(([page, title], i) => ranges.push({ title, from: i === 0 ? 0 : page, to: (starts[i + 1]?.[0] ?? pages.length) - 1 }));
  } else {
    for (let from = 0; from < pages.length; from += PDF_PAGES_PER_PART) {
      const to = Math.min(pages.length, from + PDF_PAGES_PER_PART) - 1;
      ranges.push({ title: partTitle(from + 1, to + 1), from, to });
    }
  }
  return ranges
    .map((r) => ({ title: r.title.slice(0, 120), text: pages.slice(r.from, r.to + 1).flat().join("\n\n") }))
    .filter((c) => c.text.trim());
}
