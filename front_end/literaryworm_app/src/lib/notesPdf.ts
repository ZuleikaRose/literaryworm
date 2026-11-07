import type { BookNotes } from "./exportNotes";
import { HIGHLIGHT_COLORS } from "./highlights";

/**
 * Notes and highlights as a PDF, made in the browser and saved as a file like the Markdown and
 * text exports (nothing is uploaded). A small writer of our own: A4 pages, the PDF standard
 * fonts (Helvetica and Times), text in Windows-1252, so letters outside it (Greek, Cyrillic,
 * Chinese…) show as "?"; the Markdown export keeps them.
 */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 56;
const TEXT_W = PAGE_W - MARGIN * 2;

export type Font = "F1" | "F2" | "F3" | "F4"; // Helvetica, Helvetica-Bold, Helvetica-Oblique, Times-Italic
const FONT_NAMES: Record<Font, string> = { F1: "Helvetica", F2: "Helvetica-Bold", F3: "Helvetica-Oblique", F4: "Times-Italic" };

// Helvetica's widths for ASCII 32–126, in thousandths of the font size (from the standard metrics).
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];

/** Width of text at a size: Helvetica's widths, a little wider for bold (Times is narrower, so it fits). */
export function textWidth(text: string, size: number, font: Font = "F1"): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    units += code >= 32 && code <= 126 ? HELVETICA[code - 32] : 556;
  }
  return (units * size * (font === "F2" ? 1.06 : 1)) / 1000;
}

/** Lines no wider than `width`: at spaces, and inside a word only when the word alone is too wide. */
export function wrap(text: string, size: number, width: number, font: Font = "F1"): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, size, font) <= width) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (textWidth(line, size, font) > width) {
        let cut = line.length - 1;
        while (cut > 1 && textWidth(line.slice(0, cut), size, font) > width) cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

// Windows-1252's characters above 127 that aren't Latin-1.
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "„": 0x84, "…": 0x85, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "™": 0x99,
  "Œ": 0x8c, "œ": 0x9c, "Š": 0x8a, "š": 0x9a, "Ž": 0x8e, "ž": 0x9e, "Ÿ": 0x9f,
};

/** A PDF string: ( ) and \ escaped, Windows-1252 above 127 written as octal, anything else "?". */
export function pdfString(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") out += `\\${ch}`;
    else if (code >= 32 && code <= 126) out += ch;
    else {
      const byte = CP1252[ch] ?? (code >= 160 && code <= 255 ? code : 63);
      out += byte === 63 ? "?" : `\\${byte.toString(8).padStart(3, "0")}`;
    }
  }
  return `(${out})`;
}

type Block = { font: Font; size: number; text: string; indent?: number; before: number; color?: string; bar?: boolean };

export const RUST = "0.635 0.306 0.184";
export const MUTED = "0.357 0.341 0.314";

const colourLabel = (value: string) => HIGHLIGHT_COLORS.find((c) => c.value === value)?.label ?? value;
const chapterTitle = (book: BookNotes, index: number) => book.chapterTitles[index] ?? `Chapter ${index + 1}`;
const dayFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

/** What goes on the pages, in order. */
export function notesBlocks(books: BookNotes[], now = new Date()): Block[] {
  const blocks: Block[] = [];
  const withNotes = books.filter((b) => b.highlights.length > 0 || (b.journal?.length ?? 0) > 0);
  if (withNotes.length > 1) blocks.push({ font: "F2", size: 22, text: "My notes and highlights", before: 0 });
  for (const book of withNotes) {
    blocks.push({ font: "F2", size: withNotes.length > 1 ? 17 : 22, text: book.title, before: blocks.length ? 26 : 0 });
    if (book.author) blocks.push({ font: "F3", size: 12, text: book.author, before: 4, color: MUTED });
    const highlights = [...book.highlights].sort((a, b) => a.chapterIndex - b.chapterIndex || a.page - b.page || a.start - b.start);
    let chapter = -1;
    for (const h of highlights) {
      if (h.chapterIndex !== chapter) {
        chapter = h.chapterIndex;
        blocks.push({ font: "F2", size: 13, text: chapterTitle(book, chapter), before: 18, color: RUST });
      }
      blocks.push({ font: "F4", size: 12, text: h.quote, indent: 14, before: 10, bar: true });
      blocks.push({ font: "F1", size: 9, text: `Page ${h.page + 1} · ${colourLabel(h.color)}`, indent: 14, before: 4, color: MUTED });
      if (h.note) blocks.push({ font: "F1", size: 11, text: `Note: ${h.note}`, indent: 14, before: 4 });
    }
    const journal = [...(book.journal ?? [])].sort((a, b) => a.writtenOn.localeCompare(b.writtenOn) || a.createdAt - b.createdAt);
    if (journal.length) {
      blocks.push({ font: "F2", size: 13, text: "Journal", before: 18, color: RUST });
      for (const e of journal) {
        blocks.push({ font: "F2", size: 10, text: dayFormat.format(new Date(`${e.writtenOn}T00:00:00Z`)), before: 10 });
        blocks.push({ font: "F1", size: 11, text: e.body, before: 3 });
      }
    }
  }
  blocks.push({ font: "F3", size: 9, text: `Exported from LiteraryWorm on ${dayFormat.format(now)}.`, before: 24, color: MUTED });
  return blocks;
}

/** The page contents (PDF drawing operators), one string per page, from the blocks. */
export function layoutPages(blocks: Block[]): string[] {
  const pages: string[][] = [[]];
  let y = PAGE_H - MARGIN;
  const newPage = () => {
    pages.push([]);
    y = PAGE_H - MARGIN;
  };
  for (const b of blocks) {
    const leading = b.size * 1.35;
    const x = MARGIN + (b.indent ?? 0);
    const lines = wrap(b.text, b.size, TEXT_W - (b.indent ?? 0), b.font);
    y -= b.before;
    for (const line of lines) {
      if (y - leading < MARGIN) newPage();
      y -= leading;
      const ops = pages[pages.length - 1];
      // A quote has a rust bar beside each of its lines.
      if (b.bar) ops.push(`${RUST} rg ${MARGIN + 2} ${(y - 3).toFixed(1)} 2 ${leading.toFixed(1)} re f`);
      ops.push(`${b.color ?? "0.11 0.11 0.10"} rg BT /${b.font} ${b.size} Tf ${x} ${y.toFixed(1)} Td ${pdfString(line)} Tj ET`);
    }
  }
  return pages.map((ops, i) => [...ops, `${MUTED} rg BT /F1 8 Tf ${PAGE_W - MARGIN - 40} ${MARGIN - 24} Td ${pdfString(`${i + 1} / ${pages.length}`)} Tj ET`].join("\n"));
}

/** Saves the notes as a PDF on this device: "pride-and-prejudice-notes.pdf". */
export function downloadNotesPdf(books: BookNotes[], fileName: string, title: string): void {
  downloadPdf(notesPdf(books, title), fileName);
}

/** Saves PDF bytes on this device under `fileName`. */
export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The whole PDF file. Everything written is ASCII, so string lengths are byte offsets. */
export function notesPdf(books: BookNotes[], title: string, now = new Date()): Uint8Array {
  return pdfDocument(layoutPages(notesBlocks(books, now)), title);
}

/** A PDF file from page contents (drawing operators), with the standard fonts F1–F4; A4 upright unless sized. */
export function pdfDocument(pages: string[], title: string, width = PAGE_W, height = PAGE_H): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(""); // the page tree, filled in once the pages' numbers are known
  const fonts = (Object.keys(FONT_NAMES) as Font[]).map((f) => {
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAMES[f]} /Encoding /WinAnsiEncoding >>`);
    return `/${f} ${objects.length} 0 R`;
  });
  const pageIds: number[] = [];
  for (const content of pages) {
    add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const contentId = objects.length;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << ${fonts.join(" ")} >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(objects.length);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  add(`<< /Title ${pdfString(title)} /Producer (LiteraryWorm) >>`);
  const infoId = objects.length;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}
