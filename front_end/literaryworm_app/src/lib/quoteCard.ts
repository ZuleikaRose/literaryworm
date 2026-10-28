import type { Book, Highlight } from "../types";
import { drawCover, wrapLines } from "./coverArt";

/**
 * A highlight as a picture to share: the quote in large type, the book's cover and who wrote
 * it, on the book's own colours or a plain light or dark card. Drawn on a canvas in the
 * browser; nothing is uploaded. 1080 × 1350, the portrait size social apps show in full.
 */

export type QuoteCardTheme = "cover" | "light" | "dark";

export const QUOTE_CARD_THEMES: { value: QuoteCardTheme; label: string }[] = [
  { value: "cover", label: "Book colours" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 96;

type CardBook = Pick<Book, "id" | "title" | "author" | "cover" | "genres">;

function palette(book: CardBook, theme: QuoteCardTheme): { bg: string; ink: string; muted: string } {
  // Canvas colours, not CSS: the card keeps the same look whatever theme the app is in.
  if (theme === "light") return { bg: "#f6f1e8", ink: "#1c1a17", muted: "#5d574f" };
  if (theme === "dark") return { bg: "#14171a", ink: "#f1ece4", muted: "#a3a7a9" };
  return { bg: book.cover.bg, ink: book.cover.ink, muted: book.cover.ink };
}

/** The card's fonts, so the first card isn't drawn in a fallback face. */
async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load('400 48px "Literata"'),
      document.fonts.load('italic 400 48px "Literata"'),
      document.fonts.load('700 32px "Manrope"'),
      document.fonts.load('500 28px "DM Sans"'),
    ]);
  } catch {
    // Offline or blocked: the system fonts named after them in each font list stand in.
  }
}

/** Draws the card and returns its canvas. */
export async function drawQuoteCard(book: CardBook, highlight: Pick<Highlight, "quote" | "chapterIndex">, theme: QuoteCardTheme): Promise<HTMLCanvasElement> {
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the card.");
  const { bg, ink, muted } = palette(book, theme);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (theme === "cover") {
    // A soft wash of the cover's accent behind the text, so long quotes stay readable.
    ctx.fillStyle = book.cover.accent;
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.arc(WIDTH * 0.85, HEIGHT * 0.12, 420, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // The opening quotation mark.
  ctx.fillStyle = theme === "cover" ? book.cover.accent : muted;
  ctx.font = '400 220px "Literata", Georgia, serif';
  ctx.textBaseline = "top";
  ctx.fillText("“", PAD - 12, PAD - 40);

  // The quote, as large as it fits between the mark and the footer.
  const quote = highlight.quote.trim().replace(/\s+/g, " ");
  const top = PAD + 170;
  const bottom = HEIGHT - PAD - 300;
  let size = 64;
  let lines: string[] = [];
  for (; size >= 30; size -= 2) {
    ctx.font = `400 ${size}px "Literata", Georgia, serif`;
    lines = wrapLines(ctx, quote, WIDTH - PAD * 2, 40);
    if (lines.length * size * 1.4 <= bottom - top) break;
  }
  // Still too long at the smallest size: cut it, ending in "…".
  const maxLines = Math.floor((bottom - top) / (size * 1.4));
  if (lines.length > maxLines) lines = wrapLines(ctx, quote, WIDTH - PAD * 2, maxLines);
  ctx.fillStyle = ink;
  lines.forEach((line, i) => ctx.fillText(line, PAD, top + i * size * 1.4));

  // Footer: the cover, then the title, author and chapter.
  const coverW = 150;
  const coverH = 225;
  const footY = HEIGHT - PAD - coverH;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawCover(ctx, book, PAD, footY, coverW, coverH);
  ctx.restore();

  const textX = PAD + coverW + 40;
  const textW = WIDTH - textX - PAD;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = ink;
  ctx.font = '700 40px "Manrope", system-ui, sans-serif';
  const titleLines = wrapLines(ctx, book.title, textW, 2);
  let y = footY + 70;
  for (const line of titleLines) {
    ctx.fillText(line, textX, y);
    y += 48;
  }
  ctx.fillStyle = muted;
  ctx.globalAlpha = theme === "cover" ? 0.85 : 1;
  ctx.font = '500 30px "DM Sans", system-ui, sans-serif';
  ctx.fillText(wrapLines(ctx, book.author, textW, 1)[0] ?? "", textX, y + 4);
  ctx.fillText(`Chapter ${highlight.chapterIndex + 1}`, textX, y + 46);
  ctx.font = '700 26px "Manrope", system-ui, sans-serif';
  ctx.fillText("literaryworm.com", textX, footY + coverH);
  ctx.globalAlpha = 1;
  return canvas;
}

/** The card as a PNG. */
export async function quoteCardBlob(book: CardBook, highlight: Pick<Highlight, "quote" | "chapterIndex">, theme: QuoteCardTheme): Promise<Blob> {
  const canvas = await drawQuoteCard(book, highlight, theme);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("This browser can't make the picture."))), "image/png"),
  );
}

/** A file name for the card: "pride-and-prejudice-quote.png". */
export function quoteCardFileName(book: Pick<Book, "title">): string {
  const slug = book.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "literaryworm"}-quote.png`;
}
