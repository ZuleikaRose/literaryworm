import type { Highlight } from "../types";
import { HIGHLIGHT_COLORS } from "./highlights";

/**
 * Export highlights and notes as Markdown or plain text, made in the browser and saved as a
 * file: nothing is uploaded.
 */
export type ExportFormat = "markdown" | "text";

export interface BookNotes {
  title: string;
  author: string | null;
  /** Chapter titles by index, where known. */
  chapterTitles: string[];
  highlights: Highlight[];
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" });
const colourLabel = (h: Highlight) => HIGHLIGHT_COLORS.find((c) => c.value === h.color)?.label ?? h.color;
const chapterTitle = (book: BookNotes, index: number) => book.chapterTitles[index] ?? `Chapter ${index + 1}`;

function inOrder(highlights: Highlight[]): Highlight[] {
  return [...highlights].sort((a, b) => a.chapterIndex - b.chapterIndex || a.page - b.page || a.start - b.start);
}

function chapters(highlights: Highlight[]): number[] {
  return [...new Set(inOrder(highlights).map((h) => h.chapterIndex))];
}

function bookMarkdown(book: BookNotes, level: number): string {
  const hashes = "#".repeat(level);
  const lines = [`${hashes} ${book.title}`];
  if (book.author) lines.push("", `*${book.author}*`);
  for (const index of chapters(book.highlights)) {
    lines.push("", `${hashes}# ${chapterTitle(book, index)}`);
    for (const h of inOrder(book.highlights).filter((x) => x.chapterIndex === index)) {
      lines.push("", ...h.quote.split("\n").map((l) => `> ${l}`));
      lines.push("", `Page ${h.page + 1} · ${colourLabel(h)}`);
      if (h.note) lines.push("", `**Note:** ${h.note}`);
    }
  }
  return lines.join("\n");
}

function bookText(book: BookNotes): string {
  const heading = book.author ? `${book.title} by ${book.author}` : book.title;
  const lines = [heading, "=".repeat(Math.min(heading.length, 72))];
  for (const index of chapters(book.highlights)) {
    const title = chapterTitle(book, index);
    lines.push("", title, "-".repeat(Math.min(title.length, 72)));
    for (const h of inOrder(book.highlights).filter((x) => x.chapterIndex === index)) {
      lines.push("", `"${h.quote}"`, `(page ${h.page + 1}, ${colourLabel(h).toLowerCase()})`);
      if (h.note) lines.push(`Note: ${h.note}`);
    }
  }
  return lines.join("\n");
}

/** One book, or several under a heading of their own. */
export function exportNotes(books: BookNotes[], format: ExportFormat, now = new Date()): string {
  const withNotes = books.filter((b) => b.highlights.length > 0);
  const stamp = `Exported from LiteraryWorm on ${dateFormat.format(now)}.`;
  if (format === "markdown") {
    if (withNotes.length === 1) return `${bookMarkdown(withNotes[0], 1)}\n\n---\n\n${stamp}\n`;
    return `# My notes and highlights\n\n${stamp}\n\n${withNotes.map((b) => bookMarkdown(b, 2)).join("\n\n")}\n`;
  }
  return `${withNotes.map(bookText).join("\n\n\n")}\n\n${stamp}\n`;
}

/** A file name from the title: "pride-and-prejudice-notes.md". */
export function exportFileName(title: string, format: ExportFormat): string {
  const slug =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "notes";
  return `${slug}-notes.${format === "markdown" ? "md" : "txt"}`;
}

/** Saves text as a file on this device. */
export function downloadText(text: string, fileName: string, format: ExportFormat) {
  const blob = new Blob([text], { type: format === "markdown" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
